import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white animate-fade-in">
      
      {/* Header */}
      <div>
        <Link href="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          &larr; Back to Platform
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent mt-2">
          Privacy Policy
        </h1>
        <p className="text-neutral-500 text-xs mt-2.5 font-mono">
          Last Updated: June 20, 2026
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-8 text-neutral-300 text-xs leading-relaxed font-medium bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl">
        
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">1. Information We Collect</h2>
          <p>
            We collect information you provide directly or generate automatically during your development sessions. This includes:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Authentication Data:</strong> When authenticating via Google OAuth or credentials, we synchronize your email, full name, and profile picture URL.</li>
            <li><strong>Code and Repository Indexing (RAG):</strong> During repository synchronization, our pipeline walks your target workspace directory, parses Python AST structures, splits JS/TS files into 25-line increments, computes token vector embeddings, and stores these chunks inside the `FileIndex` table.</li>
            <li><strong>Workspace & Concurrency Data:</strong> Active file lock checkouts are registered dynamically in the `FileLock` table to coordinate concurrent editing.</li>
            <li><strong>Sandbox Telemetry:</strong> Sandbox execution counts and cumulative durations are aggregated in a local configuration file (`sandbox-stats.json`) for performance metrics tracking.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">2. How We Use Your Information</h2>
          <p>
            Your developer data is processed strictly for the following services:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li>Maintaining account sessions, caching developer settings, and rendering your dashboard.</li>
            <li>Supplying semantic search matches from indexed repository code chunks to our LLM completion models.</li>
            <li>Coordinating sandbox code executions and returning run console buffers (stdout/stderr).</li>
            <li>Managing hashed API keys to identify and authorize programmatic requests.</li>
          </ul>
          <p className="mt-2 font-semibold text-emerald-400">
            We do not sell, rent, or trade your source code, workspace assets, or index configurations to any third-party marketing companies.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">3. Third-Party Data Processing</h2>
          <p>
            To deliver complete platform features, we share data with the following authorized third parties:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Stripe:</strong> All subscription processing, card details, and billing workflows are directed to Stripe. We do not store credit card credentials on our platform.</li>
            <li><strong>AI Completion Models:</strong> To generate suggestions, relevant code chunks are queried via semantic search and sent as contextual inputs to LLM APIs (including Google Gemini and CodexForge MoE).</li>
            <li><strong>Fallback Sandbox (EMKC Piston):</strong> If the local microVM backend is offline, code snippets are forwarded to EMKC's gVisor-isolated Piston service for secure execution.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">4. Data Deletion, Retention & User Rights</h2>
          <p>
            In compliance with GDPR, CCPA, and global data privacy standards, you maintain absolute control over your personal and workspace information:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Complete Data Wipe:</strong> Triggering the Data Wipe endpoint (`POST /api/v1/user/delete-data`) immediately purges all of your conversation history, messages, generated API keys, and active file locks.</li>
            <li><strong>Account Deletion:</strong> Triggering the Account Deletion endpoint (`POST /api/v1/user/delete-account`) completely removes your user profile, avatar reference, and associated database entries.</li>
          </ul>
          <p className="mt-2 text-neutral-400">
            Residual transient database transaction logs may persist in short-term database backups for up to 30 days before being completely overwritten.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">5. Cookies & Local Session Storage</h2>
          <p>
            We use secure HTTP-only cookies and local storage tokens to handle authenticated session persistence with Supabase. Clearing your cookies will immediately terminate your session and close connection permissions to the database.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">6. Contact Information & Concerns</h2>
          <p>
            If you have questions regarding data retention, security practices, or wish to request an archive of your active profile, please reach out to:
          </p>
          <p className="font-mono mt-1 text-neutral-400">
            Email: sdixon182007@gmail.com
          </p>
        </section>

      </div>
      
    </div>
  );
}
