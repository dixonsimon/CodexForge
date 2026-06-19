import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-[#060606] text-white overflow-hidden">
      
      {/* Background Glowing Orb Effect */}
      <div className="absolute top-[-10%] left-[50%] translate-x-[-50%] w-[600px] h-[300px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28 lg:py-36 flex flex-col items-center justify-center flex-grow text-center relative z-10">
        
        {/* Release Pill (Monochrome modern highlight) */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-[#1f1f1f] text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-8 animate-fade-in">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          CodexForge Workspace v1.0.0
        </div>

        {/* Hero Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-none max-w-4xl bg-gradient-to-b from-white via-neutral-100 to-neutral-500 bg-clip-text text-transparent">
          Autonomous Code Assistant & Executable Sandbox
        </h1>

        {/* Hero Subtitle */}
        <p className="max-w-2xl mx-auto text-xs sm:text-sm text-neutral-400 mb-12 leading-relaxed font-medium">
          Secure execution in ephemeral virtual runtimes, dynamic semantic repository sync, and a premium monochrome developer console built for speed.
        </p>

        {/* Dynamic Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 w-full sm:w-auto">
          <Link
            href="/chat"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition-all text-center active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Launch Assistant
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-neutral-900 border border-[#1f1f1f] text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all text-center active:scale-95"
          >
            View Telemetry
          </Link>
        </div>

        {/* Premium Features Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left w-full">
          
          {/* Card 1 */}
          <div className="bg-[#0c0c0c] border border-[#1f1f1f] hover:border-neutral-700 p-8 rounded-3xl transition-all duration-300 group hover:-translate-y-1">
            <div className="h-10 w-10 rounded-2xl bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center mb-6 text-white group-hover:bg-white group-hover:text-black transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3M13 15h3" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-2.5">Isolated Sandboxes</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-medium">
              Run simulated code blocks dynamically in sandboxed virtual layers. Zero risk, instant performance metrics outputs.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0c0c0c] border border-[#1f1f1f] hover:border-neutral-700 p-8 rounded-3xl transition-all duration-300 group hover:-translate-y-1">
            <div className="h-10 w-10 rounded-2xl bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center mb-6 text-white group-hover:bg-white group-hover:text-black transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <path d="M12 7v10M5 19h14" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-2.5">Semantic RAG Indexing</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-medium">
              High fidelity parser indexes code repositories, extracting AST representations to build context-aware completions prompt scopes.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0c0c0c] border border-[#1f1f1f] hover:border-neutral-700 p-8 rounded-3xl transition-all duration-300 group hover:-translate-y-1">
            <div className="h-10 w-10 rounded-2xl bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center mb-6 text-white group-hover:bg-white group-hover:text-black transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m0 0a2 2 0 01-2 2m2-2a2 2 0 00-2-2M9 12H3m3-3v6m6-3h3m2 3.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white mb-2.5">Key Manager & telemetry</h3>
            <p className="text-xs text-neutral-400 leading-relaxed font-medium">
              Create and manage hashed developer tokens, monitor token usage statistics, and inspect platform latencies dynamically.
            </p>
          </div>

        </div>

      </div>

      {/* Landing Page Footer */}
      <footer className="w-full border-t border-[#1f1f1f] bg-[#0c0c0c] py-8 text-center text-[10px] text-neutral-500 relative z-10 select-none">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-semibold">
            &copy; {new Date().getFullYear()} CodexForge. All rights reserved.
          </div>
          <div className="flex gap-5 font-semibold">
            <Link href="/terms" className="hover:text-neutral-400 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy Policy</Link>
            <Link href="/docs" className="hover:text-neutral-400 transition-colors">Docs</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
