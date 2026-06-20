import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-10 w-full min-h-screen bg-[#060606] text-white animate-fade-in">
      
      {/* Header */}
      <div>
        <Link href="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
          &larr; Back to Platform
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent mt-2">
          Terms of Service
        </h1>
        <p className="text-neutral-500 text-xs mt-2 font-mono">
          Last Updated: June 20, 2026
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-8 text-neutral-300 text-xs leading-relaxed font-medium bg-[#0c0c0c] border border-[#1f1f1f] p-8 sm:p-10 rounded-3xl shadow-2xl">
        
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">1. Agreement to Terms</h2>
          <p>
            Welcome to CodexForge ("Platform", "Service", "we", "us", or "our"). By registering an account, authenticating via Google OAuth, generating API keys, or using our sandboxed workspaces, collaborative workspace lock features, and developer assistant integrations, you agree to be bound by these Terms of Service. If you do not agree to these terms, you are prohibited from accessing or using our Platform and must immediately terminate your session.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">2. Description of Services</h2>
          <p>
            CodexForge provides a collaborative development and container-isolated playground environment consisting of:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Isolated VM Sandboxes:</strong> Ephemeral virtual machines (powered by secure Firecracker/KVM architecture, with secure gVisor-sandboxed fallback runtimes) for executing code scripts, compilers, and test suites.</li>
            <li><strong>AI Coding Assistants:</strong> Large language model integrations (including CodexForge Mixture of Experts and Gemini models) that process contextual repository inputs to generate streamable completions.</li>
            <li><strong>Repository Indexing (RAG):</strong> Pipeline scripts that walk workspace directories, parse AST trees (classes and functions), compute token embeddings, and cache indexed representations mapped to your project.</li>
            <li><strong>Collaborative Workspace Locks:</strong> A database-backed concurrency coordinator (`FileLock` registry) allowing developers to check out and lock specific paths, preventing code overwrite conflicts during active edit sessions.</li>
            <li><strong>Developer API Credentials:</strong> Scoped developer credentials allowing programmatic interactions with our completions, sync, and execution sandboxes.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">3. Acceptable Use Policy & VM Security</h2>
          <p>
            Your access to our isolated VM environments is subject to strict virtualization boundaries. You agree not to engage in, attempt, or facilitate any of the following prohibited behaviors:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Sandbox Escapes:</strong> Any attempt to escape microVM boundaries, bypass kernel isolation, access host resources, or read memory frames of sibling containers.</li>
            <li><strong>Network Abuse:</strong> Launching Denial of Service (DDoS) requests, port scanning, brute-forcing external targets, or running unauthorized network proxies/relays.</li>
            <li><strong>Resource Exploitation:</strong> Utilizing sandboxed runtimes for cryptocurrency mining, participating in distributed computing grids, hosting persistent public servers, or executing CPU/memory exhaustion loops designed to disrupt platform metrics.</li>
            <li><strong>Malicious Material:</strong> Uploading, testing, or executing malware, rootkits, ransomware, spyware, or scripts explicitly constructed to probe or exploit software vulnerabilities.</li>
          </ul>
          <p className="mt-2 text-red-400 font-semibold">
            Violating these virtualization security limits results in immediate, non-refundable account termination, deletion of database records, and reporting to relevant legal authorities.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">4. User Accounts, API Keys & Authentication</h2>
          <p>
            To utilize protected features, users must authenticate through our Supabase Auth OAuth provider integrations. You are solely responsible for maintaining the confidentiality of your session tokens, cookies, and active developer API keys. You agree that:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li>You will immediately notify sdixon182007@gmail.com of any unauthorized use of your API keys or database profiles.</li>
            <li>We store only cryptographic hashes of API keys (`keyHash` schema). Lost API keys cannot be recovered by our team and must be regenerated.</li>
            <li>You accept full liability for all calculations, resource expenditures, VM minutes consumed, and database queries executed under your authenticated credentials.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">5. Organizations, Billing, Stripe Subscriptions & Quotas</h2>
          <p>
            Access to higher resource tiers (e.g., Developer or Enterprise Tiers) is billed on a subscription basis managed securely through our Stripe payment portal integrations.
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Resource Quotas:</strong> Resource usage limits are checked at the organization level (`gpuTokenLimit` and `sandboxTimeLimit` columns per member). Exceeding these bounds restricts completions, re-indexing syncs, and sandbox executions until the cycle resets or the tier is upgraded.</li>
            <li><strong>Refund Policy:</strong> All subscription charges are non-refundable. You may cancel your subscription at any time to avoid renewal at the end of the current billing period.</li>
            <li><strong>Tier Downgrades:</strong> Downgrading your subscription tier will immediately constrain quotas to Free Sandbox limits. We assume no liability for data truncation, expired file locks, or index deletions resulting from quota adjustments.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">6. Intellectual Property & Code Ownership</h2>
          <p>
            <strong>Your Code:</strong> You retain complete ownership, copyright, and intellectual property rights to the source code, repository files, and workspace assets you upload, compile, or index on CodexForge. We do not claim any licensing rights or ownership over your intellectual property.
          </p>
          <p>
            <strong>Our Platform:</strong> CodexForge retains all rights, titles, and interest in and to our proprietary coding models, compiler interfaces, microVM orchestration architectures, UI layouts, and branding assets. You may not copy, reverse-engineer, or redistribute our proprietary components.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">7. Disclaimers & Limitation of Liability</h2>
          <p>
            CODEXFORGE AND ITS SANDBOXED VM WORKSPACES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE PLATFORM WILL BE FREE OF INTERRUPTIONS, CORRUPTIONS, OR VM SHUTDOWNS.
          </p>
          <p className="mt-1">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL CODEXFORGE OR ITS DEVELOPERS BE LIABLE FOR ANY INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES (INCLUDING LOSS OF DATA, REVENUE, CODE REPOSITORIES, OR DATABASE ACCESS) ARISING OUT OF THE USE OR INABILITY TO USE THE PLATFORM.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">8. Data Retention, Wipes & User Deletion</h2>
          <p>
            In compliance with our privacy policies, we provide user-controlled data management features:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 mt-1 text-neutral-400">
            <li><strong>Data Wipe (`/api/v1/user/delete-data`):</strong> Permanently purges your chat conversation history, message tables, generated API keys, and active file locks.</li>
            <li><strong>Account Deletion (`/api/v1/user/delete-account`):</strong> Permanently deletes your user entity, profile information, and organization associations from the database.</li>
          </ul>
          <p className="mt-2 text-neutral-400">
            We reserve the right to suspend or terminate accounts and wipe database rows if we detect violations of these terms, sandbox security bypasses, or fraudulent billing activities.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#1f1f1f] pb-2">9. Changes to Terms</h2>
          <p>
            We reserve the right to modify or replace these Terms of Service at any time. We will indicate revisions by updating the "Last Updated" date at the top of this document. Continued use of the platform constitutes agreement to the updated terms.
          </p>
        </section>

      </div>
      
    </div>
  );
}
