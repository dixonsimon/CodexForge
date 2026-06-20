import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white animate-fade-in">
      
      {/* Header */}
      <div>
        <Link href="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          &larr; Back to Platform
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent mt-2">
          CodexForge API & Platform Docs
        </h1>
        <p className="text-neutral-400 text-xs mt-2 font-medium">
          Detailed technical references, architectural specs, database models, and API integrations for the CodexForge platform.
        </p>
      </div>

      {/* Docs Content */}
      <div className="flex flex-col gap-8 text-neutral-300 text-xs leading-relaxed font-medium">
        
        {/* Architecture */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">1. Core Platform Architecture</h2>
          <p>
            CodexForge operates as a container-isolated developer playground and semantic code assistant, utilizing Next.js app routes, a PostgreSQL database managed via Prisma, and Supabase Auth session controls.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>VM Sandbox Isolation:</strong> Executes runtime scripts in isolated Firecracker microVMs or fallback Piston gVisor sandboxes to isolate environment dependencies and secure network interfaces.</li>
            <li><strong>AST Repository Indexing (RAG):</strong> Parses codebase context into localized semantic data representations, computing token embeddings matching the target search index.</li>
            <li><strong>Collaborative Lock Sync:</strong> Maintains database-backed concurrency states (`FileLock` table) to verify coordinate checkout paths and prevent file conflicts.</li>
          </ul>
        </section>

        {/* Semantic Indexing (RAG) */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">2. Repository Syncing & RAG Indexing</h2>
          <p>
            When a project repository synchronization is triggered:
          </p>
          <ol className="list-decimal pl-5 flex flex-col gap-2 mt-1 text-neutral-400">
            <li>The system walks the project root directory, ignoring common artifacts (e.g. `node_modules`, `.next`, `.git`, `.gemini`).</li>
            <li><strong>Python Parsing:</strong> Python source files are parsed for function declarations (`def`) and class boundaries (`class`), splitting statements into semantic AST-aware chunks.</li>
            <li><strong>JS/TS Parsing:</strong> Javascript, Typescript, JSX, and TSX files are chunked into contiguous 25-line code blocks.</li>
            <li><strong>Vector Embeddings:</strong> L2-normalized vector embeddings are computed for each chunk based on the text contents.</li>
            <li><strong>Database Upsert:</strong> Previous index definitions for the target `projectId` are deleted and new entries are stored in the database's `FileIndex` schema, mapping metadata parameters, file sizes, and computed embedding vectors.</li>
          </ol>
        </section>

        {/* API Specification */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">3. Developer API Reference</h2>
          <p>
            All endpoints are scoped and managed securely under `/api/v1`. Authentication state requires valid session tokens or hashed `ApiKey` credentials.
          </p>
          
          <div className="flex flex-col gap-4 font-mono text-[11px] text-neutral-400 mt-2">
            
            {/* Endpoint 1 */}
            <div className="bg-black/50 p-4 border border-[#1f1f1f] rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-950/60 text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-900/60 uppercase tracking-wide text-[9px]">POST</span>
                <span className="text-white font-bold text-xs">/api/v1/chat/completions</span>
              </div>
              <p className="text-neutral-400 font-sans mt-1">
                Streams AI response completions. Utilizes similarity indices from synchronized codebases to inject context matching user prompts.
              </p>
            </div>

            {/* Endpoint 2 */}
            <div className="bg-black/50 p-4 border border-[#1f1f1f] rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-950/60 text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-900/60 uppercase tracking-wide text-[9px]">POST</span>
                <span className="text-white font-bold text-xs">/api/v1/sandbox/execute</span>
              </div>
              <p className="text-neutral-400 font-sans mt-1">
                Runs arbitrary code buffers in the secure VM sandbox. Returns structured JSON containing standard execution responses (`stdout`, `stderr`, `exitCode`, and `executionTimeMs`).
              </p>
            </div>

            {/* Endpoint 3 */}
            <div className="bg-black/50 p-4 border border-[#1f1f1f] rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-950/60 text-emerald-400 font-bold px-2 py-0.5 rounded-md border border-emerald-900/60 uppercase tracking-wide text-[9px]">POST</span>
                <span className="text-white font-bold text-xs">/api/v1/repos/sync</span>
              </div>
              <p className="text-neutral-400 font-sans mt-1">
                Re-scans files in the specified project repository, parses code signatures, calculates vector indices, and updates the `FileIndex` schemas.
              </p>
            </div>

            {/* Endpoint 4 */}
            <div className="bg-red-950/20 p-4 border border-[#2f1f1f] rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-red-950/60 text-red-400 font-bold px-2 py-0.5 rounded-md border border-red-900/60 uppercase tracking-wide text-[9px]">POST</span>
                <span className="text-white font-bold text-xs">/api/v1/user/delete-data</span>
              </div>
              <p className="text-neutral-400 font-sans mt-1">
                Removes all user chat conversations, message tables, generated API keys, and active file lock entries.
              </p>
            </div>

            {/* Endpoint 5 */}
            <div className="bg-red-950/20 p-4 border border-[#2f1f1f] rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-red-950/60 text-red-400 font-bold px-2 py-0.5 rounded-md border border-red-900/60 uppercase tracking-wide text-[9px]">POST</span>
                <span className="text-white font-bold text-xs">/api/v1/user/delete-account</span>
              </div>
              <p className="text-neutral-400 font-sans mt-1">
                Permanently purges the user profile entity and associated organization relationships from CodexForge indexes.
              </p>
            </div>

          </div>
        </section>

        {/* Collaborative File Locks */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">4. Collaborative Concurrency (File Lock Protocol)</h2>
          <p>
            To permit simultaneous workspace updates, CodexForge tracks checkouts using the `FileLock` model:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Acquisition:</strong> When a user begins modifying a path, a unique composite lock constraint `[projectId, filePath]` is stored in the database mapping user metadata and expiration timestamps.</li>
            <li><strong>Release:</strong> Locks are cleared when files are closed or when duration cycles (`expiresAt`) expire.</li>
            <li><strong>Access Guard:</strong> Workspace routes confirm active lock permissions, blocking overwrite requests if files are actively checked out by another developer.</li>
          </ul>
        </section>

        {/* Support */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">5. Platform Integration Support</h2>
          <p>
            For assistance with programmatic API tokens, rate limits, custom sandbox setups, or database connections, email:
          </p>
          <p className="font-mono mt-1 text-neutral-400">
            sdixon182007@gmail.com
          </p>
        </section>

      </div>
      
    </div>
  );
}
