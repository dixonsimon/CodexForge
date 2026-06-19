import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white">
      
      {/* Header */}
      <div>
        <Link href="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent mt-2">
          CodexForge Documentation
        </h1>
        <p className="text-neutral-400 text-xs mt-2.5 font-medium">
          Comprehensive guides and specifications to integrate with CodexForge platforms and isolation workspaces.
        </p>
      </div>

      {/* Docs Sections */}
      <div className="flex flex-col gap-8 text-neutral-300 text-xs leading-relaxed font-medium">
        
        {/* Section 1 */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 rounded-3xl">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">1. Platform Architecture Overview</h2>
          <p className="mb-4">
            CodexForge is built as a unified serverless environment targeting Vercel deployment and utilizing Supabase PostgreSQL schemas. The platform integrates:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-2">
            <li><strong>Isolated Sandboxes:</strong> Run scripts and snippets dynamically in client-virtualized runtimes without hosting risks.</li>
            <li><strong>Semantic Code Indexing (RAG):</strong> Parses repositories to load chunks and compute vectors mapped for assistant completions.</li>
            <li><strong>Developer Token Access:</strong> Secure client-hashed API keys issued scoped to model paths.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 rounded-3xl">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">2. API Endpoints Reference</h2>
          <p className="mb-4">
            All routes are segmented inside standard serverless handlers under `/api/v1`:
          </p>
          <div className="flex flex-col gap-3 font-mono text-[11px] text-neutral-400">
            <div className="bg-black/50 p-3.5 border border-[#1f1f1f] rounded-2xl flex flex-col gap-1">
              <span className="text-white font-bold text-[10px] uppercase tracking-wider text-emerald-400">POST /api/v1/chat/completions</span>
              <span>Completions prompt router. Streams SSE chunks matching similarities computed from Indexed repositories.</span>
            </div>
            <div className="bg-black/50 p-3.5 border border-[#1f1f1f] rounded-2xl flex flex-col gap-1">
              <span className="text-white font-bold text-[10px] uppercase tracking-wider text-emerald-400">POST /api/v1/sandbox/execute</span>
              <span>Virtual VM runner. Executes JS logs or Python print output loops.</span>
            </div>
            <div className="bg-black/50 p-3.5 border border-[#1f1f1f] rounded-2xl flex flex-col gap-1">
              <span className="text-white font-bold text-[10px] uppercase tracking-wider text-emerald-400">POST /api/v1/repos/sync</span>
              <span>Sync helper. Walks directories, processes AST trees, and upserts code chunks to the Supabase FileIndex.</span>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="bg-[#0c0c0c] border border-[#1f1f1f] p-8 rounded-3xl">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">3. Google OAuth & Supabase Auth</h2>
          <p className="mb-3">
            Authentication is driven via cookie-persisted tokens checked during middleware routing and callback endpoints.
          </p>
          <p>
            When registering or logging in (via manual credentials or Google provider OAuth), the server fetches the user metadata and synchronizes user profiles with custom database columns (`name`, `avatarUrl`) to maintain referential constraints on conversations and keys.
          </p>
        </section>

      </div>
      
    </div>
  );
}
