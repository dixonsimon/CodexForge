import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white">
      
      {/* Header */}
      <div>
        <Link href="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent mt-2">
          Terms of Service
        </h1>
        <p className="text-neutral-400 text-xs mt-2.5 font-medium">
          Last Updated: June 19, 2026
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-6 text-neutral-300 text-xs leading-relaxed font-medium bg-[#0c0c0c] border border-[#1f1f1f] p-8 rounded-3xl">
        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">1. Agreement to Terms</h2>
          <p>
            By accessing or using CodexForge, you agree to be bound by these Terms of Service. If you do not agree, you must immediately cease accessing and using the platform services.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">2. Runtimes & Sandbox Use</h2>
          <p>
            You agree to use the sandboxed VM execution environments strictly for development and testing purposes. Any attempts to escape virtualization layers, run malicious scripts, mine cryptocurrency, or execute DDoS attacks will result in immediate session termination, credential revocation, and permanent service bans.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">3. Credentials Security</h2>
          <p>
            You are entirely responsible for protecting your user account passwords and hashed API keys. CodexForge is not liable for data loss or breach events stemming from credential neglect.
          </p>
        </section>

        <section>
          <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">4. Disclaimers</h2>
          <p>
            The software and VM sandboxes are provided "as-is" without warranties of any kind. CodexForge does not guarantee persistent database replication or compile runtime availability.
          </p>
        </section>
      </div>
      
    </div>
  );
}
