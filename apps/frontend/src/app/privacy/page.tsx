import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white">
      
      {/* Header */}
      <div>
        <Link href="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent mt-2">
          Privacy Policy
        </h1>
        <p className="text-neutral-400 text-xs mt-2.5 font-medium">
          Last Updated: June 19, 2026
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-6 text-neutral-300 text-xs leading-relaxed font-medium bg-[#0c0c0c] border border-[#1f1f1f] p-8 rounded-3xl">
        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">1. Information We Collect</h2>
          <p>
            When you register or authenticate via Google OAuth, we collect your email address, full name, and profile picture/avatar URL. We also store the code snippets and configurations you run inside our sandboxed execution workspace.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">2. How We Use Information</h2>
          <p>
            Your information is used solely to maintain your developer account session, persist your conversation threads, map hashed API credentials to your user profile, and run scripts in transient sandboxed VM containers. We do not sell your personal data or code assets.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">3. VM Sandbox Execution Logging</h2>
          <p>
            Console stdout/stderr output logs generated during runtime script execution inside isolated containers are streamed back to your client console. We do not persist runtime container stdout logs in permanent database tables.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">4. Cookies & Session Storage</h2>
          <p>
            We use secure HTTP-only cookies and local storage tokens to manage authentication state with Supabase and track workspace telemetry. Clearing your browser cookies will sign you out and terminate the local session state.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">5. Contact Information</h2>
          <p>
            If you have questions regarding developer credential security or database storage policies, reach out to security@codexforge.ai.
          </p>
        </section>
      </div>
      
    </div>
  );
}
