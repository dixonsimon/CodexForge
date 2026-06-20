# 🤖 CodexForge: Next-Generation AI Coding & Model Training Platform

Welcome to **CodexForge**, a state-of-the-art enterprise-grade SaaS platform designed for training, deploying, scaling, and managing coding-focused Mixture of Experts (MoE) Large Language Models within secure isolated environments. 

This repository has progressed from a design blueprint into a **fully implemented production-ready codebase**, complete with an interactive Next.js IDE frontend, a NestJS core business/payments engine, a FastAPI LLM execution pipeline, and optimized Python ML training modules.

---

## 🚀 Key Implemented Features

### 1. Next-Generation IDE & Frontend SPA (`apps/frontend`)
- **Interactive Multi-Model Chat**: Clean conversational interface supporting dynamic model selection (`CodexForge-MoE`, `gpt-4o`, `gemini-3.5-flash`) and specialized agent personas (Developer, Creative Writer, Socratic Tutor).
- **Monaco Code Workspace**: A full-featured side-by-side IDE panel hosting editable files, live file locking telemetry, and code execution outputs.
- **Telemetry & Latency Dashboards**: Live performance charts powered by `Recharts` showing tokens per second throughput, sub-system response times, and system load.
- **Developer Credentials**: In-browser API key management supporting granular scopes (`read:model`, `write:sandbox`, `admin:all`).
- **Responsive Mobile Layout**: Fully optimized for mobile viewports with smooth slide-out sidebar drawers, overlays, and responsive padding systems.

### 2. Multi-Tenant SaaS Business Engine (`apps/backend-core`)
- **Stripe Webhook Billing**: Automatic synchronization of user subscription events to update DB billing levels (`free`, `developer`, `enterprise`).
- **Organization Resource Allocations**: Advanced credit controls enabling managers to assign hard quotas for GPU token budgets and sandbox runtime seconds per member.
- **Enterprise SSO & Audit Logs**: Keycloak-compatible OpenID Connect authentication flow mapped with strict RBAC guards (`SECOPS`, `LEAD_DEVELOPER`) and persistent database security ledgers.
- **CI/CD PR Reviewer Webhook**: Listens to pull request updates, spins up changed files in an AWS Firecracker VM container, executes safety tests, and posts automated AI reviews back to GitHub.

### 3. ML Training & Agentic Pipelines (`apps/backend-agent` & `model/`)
- **Distributed FSDP Training & DPO**: Scripts for sharded data-parallel training parameters and Direct Preference Optimization preference-margin loss formulas.
- **Model Merging (SLERP & TIES)**: Clean vector interpolation methods to combine parameter-level weights and resolve conflicting parameter updates.
- **YaRN Context Scaling**: Attention frequency interpolation calculations extending context windows up to 128k sequence lengths.
- **Autoregressive Back-Translation Curation**: Synthetic instruction-response generator converting codebase routines back into training prompts.
- **Mixture of Experts (MoE) Loss**: Gating load loss calculations ($L_{\text{aux}}$) preventing expert collapse during model routing optimization.
- **System Telemetry**: Local Prometheus GPU metrics exporter exposing memory constraints, latent request loops, and TTFT metrics.
- **Supervised Fine-Tuning (SFT) Alignment**: Instruction format alignment pipeline mapping prompt/response sequences and calculating cross-entropy loss weights ([sft_alignment.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/model/training/sft_alignment.py)).
- **AWS Firecracker VM Pool Allocations**: Sandbox Pool Manager balancing pool sizes, active state slots, and IP resolutions ([sandbox_pool_manager.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/apps/backend-agent/pipelines/sandbox_pool_manager.py)).
- **Local Package Mirror Registry**: Offline PyPI/npm mirror cache server whitelisting downloads and resolving library sources offline ([mirror_cache.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/apps/backend-agent/pipelines/mirror_cache.py)).
- **Compiler Feedback RLCF Loops**: Reinforcement learning pipeline loop running generated candidate code inside VM slots and utilizing compiler rewards to compute policy loss values ([rlcf_sandbox_loop.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/apps/backend-agent/pipelines/rlcf_sandbox_loop.py)).
- **AWQ 4-Bit Weight Quantization**: Invokes the quantization service to compress model parameters and export optimized AWQ configs ([quantization_runner.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/apps/backend-agent/pipelines/quantization_runner.py)).
- **Speculative Decoding Speedup**: Evaluates draft-model parallel token verification, validating throughput speeds against the >60 tokens/second threshold ([speculative_decoding_runner.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/apps/backend-agent/pipelines/speculative_decoding_runner.py)).
- **Sandbox Security Penetration**: Asserts container isolation boundaries, testing root filesystem write lockouts, outbound netfilter rules, and kernel hypervisor namespaces ([sandbox_penetration_test.py](file:///c:/Users/Dixon/OneDrive/Documents/LLM/apps/backend-agent/pipelines/sandbox_penetration_test.py)).

---

## 📂 Repository Structure

```text
codexforge/
├── apps/
│   ├── frontend/             # Next.js (TypeScript) + TailwindCSS (v4) SPA Dashboard
│   ├── backend-core/         # NestJS Core API (SSO, Stripe Payments, Credit Allocation)
│   └── backend-agent/        # FastAPI Python Service (LLM, evaluators, OTel Tracing)
├── infra/
│   ├── sandbox/              # Firecracker Daemon, eBPF TC Filters, LUKS Encryption Mounts
│   └── docker/               # Multi-stage production Docker configurations
├── project_backlog.md        # Feature tracking roadmap and Completion log
├── walkthrough.md            # Comprehensive implementation and simulation test results
└── README.md                 # Project introduction and workspace directory layout
```

---

## 🛠️ Getting Started & Local Development

### Prerequisites
- Node.js (v18+)
- Python (v3.10+) with `pip`
- PostgreSQL (database instances can be hosted locally or on Supabase)

### 1. Database Setup
Ensure that database access URLs are set inside `.env` configuration files in both `apps/backend-core` and `apps/frontend`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
```
Sync the database tables using the local Prisma CLI:
```bash
# Core Backend
cd apps/backend-core
npx.cmd --no-install prisma db push

# Frontend Page Client
cd ../frontend
npx.cmd --no-install prisma generate
```

### 2. Run NestJS Core Backend
```bash
cd apps/backend-core
npm.cmd install
npm.cmd run build
npm.cmd run start:dev
```
The NestJS server will start on port `3001` (by default).

### 3. Run Next.js Frontend Dashboard
```bash
cd apps/frontend
npm.cmd install
npm.cmd run dev
```
The dashboard UI will be live at `http://localhost:3000`.

### 4. Run Python Pipeline Simulations
```bash
cd apps/backend-agent
pip install -r requirements.txt # (PyTorch / NumPy dependencies)

# Run YaRN Scaling Simulation
python pipelines/yarn_scaling.py

# Run Back-Translation Curation
python pipelines/back_translation.py

# Run MoE Load Balancing Gating Loss
python pipelines/moe_loss.py

# Run AWQ 4-Bit Weight Quantization Pipeline
python pipelines/quantization_runner.py

# Run Speculative Decoding Speedup Verification
python pipelines/speculative_decoding_runner.py

# Run Sandbox Security Penetration Test
python pipelines/sandbox_penetration_test.py
```

---

## 🧪 Verification & Build Results

All components are fully validated:
1. **Frontend**: Next.js code compiler builds static pages with Turbopack type-checks passing cleanly.
2. **Backend Services**: NestJS core builds and packages successfully.
3. **Database Model Client**: Prisma schema columns sync directly with remote Supabase databases.
4. **Python ML Scripts**: Mathematical pipelines compute exact outputs with clean NumPy fallbacks.
