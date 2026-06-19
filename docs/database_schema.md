# Database Schema & Caching Strategy

This document defines the relational database schema, vector database layout, and caching structures required to power the CodexForge platform.

---

## 1. Relational Database Schema (PostgreSQL)

We use PostgreSQL as the primary transactional storage due to its ACID compliance, robust support for relational schemas, and performance with indexing JSONB datasets.

```mermaid
erDiagram
    USERS ||--o{ ORGANIZATIONS : owns
    USERS ||--o{ ORG_MEMBERS : member_of
    ORGANIZATIONS ||--o{ ORG_MEMBERS : contains
    ORGANIZATIONS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ CONVERSATIONS : houses
    CONVERSATIONS ||--o{ MESSAGES : has
    USERS ||--o{ API_KEYS : issues
    PROJECTS ||--o{ FILE_INDEX : indexes
    
    USERS {
        uuid id PK
        string email UNIQUE
        string password_hash
        string github_oauth_token
        string billing_tier
        timestamp created_at
        timestamp updated_at
    }

    ORGANIZATIONS {
        uuid id PK
        string name
        uuid owner_id FK
        timestamp created_at
    }

    ORG_MEMBERS {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        string role "ADMIN | DEVELOPER | VIEWER"
        timestamp joined_at
    }

    PROJECTS {
        uuid id PK
        uuid org_id FK
        string name
        string github_repo_url
        string default_branch
        string last_indexed_commit
        timestamp created_at
        timestamp updated_at
    }

    CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        uuid project_id FK "Nullable"
        string title
        string active_model
        timestamp created_at
        timestamp updated_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        string sender_role "USER | ASSISTANT | SYSTEM | TOOL"
        text content
        jsonb tool_calls "Nullable"
        integer prompt_tokens
        integer completion_tokens
        timestamp created_at
    }

    API_KEYS {
        uuid id PK
        uuid user_id FK
        string key_hash UNIQUE
        string label
        string scopes "comma-separated list"
        timestamp expires_at
        timestamp created_at
    }

    FILE_INDEX {
        uuid id PK
        uuid project_id FK
        string file_path
        string file_sha
        string file_size_bytes
        string language
        timestamp updated_at
    }
```

### DDL Schema (PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE role_type AS ENUM ('ADMIN', 'DEVELOPER', 'VIEWER');
CREATE TYPE sender_type AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    github_oauth_token TEXT,
    billing_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Organization Members Table (RBAC Mapping)
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role role_type DEFAULT 'DEVELOPER',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (org_id, user_id)
);

-- Projects Table (Connected Repos)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    github_repo_url TEXT NOT NULL,
    default_branch VARCHAR(100) DEFAULT 'main',
    last_indexed_commit VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations Table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    active_model VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table with JSONB support for agent actions
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_role sender_type NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- API Keys Table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    scopes TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

---

## 2. Vector Database Strategy (Qdrant)

To provide deep repo-level reasoning, the agent must quickly query semantic chunks of code. Qdrant is selected for its high performance, native support for payload filtering, and cluster scaling capabilities.

### Text Splitting and AST Parsing Pipeline
We do not use standard character-limit chunking, which breaks syntax and loses structure.
Instead, our parser uses `tree-sitter` to parse files and extract functions, classes, and structs as semantic entities.

```
Raw Code File
     │
     ▼
Tree-Sitter Parser ──> Extracts Functions / Classes / Modules
     │
     ├─> Small structures: Encoded directly as individual chunks.
     └─> Large structures (>800 tokens): Chunked semantically at block-level.
```

### Qdrant Collection Layout (`repo_embeddings`)

- **Distance Metric:** Cosine
- **Vector Dimensions:** 1536 (Default matching standard open-source embedders like `bge-large-en-v1.5` or `nomic-embed-text`)

#### Payload Structure

```json
{
  "project_id": "74198f3b-8eb0-4030-925e-5487dafd3cb2",
  "file_path": "src/controllers/auth.controller.ts",
  "file_sha": "a1b2c3d4e5f6...",
  "chunk_type": "function",
  "symbol_name": "loginUser",
  "code_content": "async function loginUser(req: Request, res: Response) {\n  ...",
  "dependencies": ["src/services/auth.service.ts", "src/models/user.model.ts"],
  "start_line": 42,
  "end_line": 95
}
```

#### Search Optimization (Payload Filtering)
We apply Qdrant Payload Indexes on `project_id` and `file_path`. This ensures queries are constrained strictly to the target repository's scope:

```json
{
  "filter": {
    "must": [
      { "key": "project_id", "match": { "value": "74198f3b-8eb0-4030-925e-5487dafd3cb2" } }
    ]
  }
}
```

---

## 3. Caching & Session Management (Redis)

Redis is deployed as an in-memory database to store ephemeral data, manage real-time queues, and protect APIs from abuse.

### Redis Configuration Layout

| Key Namespace | Data Type | Expiration | Description |
| :--- | :--- | :--- | :--- |
| `session:{session_token}` | Hash | 24 Hours | Stored JWT details and UI preferences. |
| `rate:limit:{user_id}:{endpoint}` | String | 1 Minute | Slit-window rate limit counter. |
| `llm:prompt:cache:{hash}` | String | 2 Hours | Caches completions for deterministic code questions (e.g., boilerplate questions). |
| `collab:lock:{project_id}:{file_path}` | String | 30 Seconds | Mutex lock for collaborative workspace multi-user coding. |

### Real-Time Pipeline (Pub/Sub & Streams)

1. **`chat:stream:{conversation_id}` (Redis Stream):**
   - The FastAPI Agent writes token packets into the Redis Stream.
   - Next.js reads from the Stream and flushes it downstream to the client browser via Server-Sent Events (SSE).

2. **`sandbox:run:{job_id}` (Redis List/Queue):**
   - When a user compiles or tests code, the NestJS Core backend inserts a execution payload into the `sandbox:run` queue.
   - The Sandbox Orchestrator picks up the job, runs it in Firecracker, and outputs stdout/stderr logs.
