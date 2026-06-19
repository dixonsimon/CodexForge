"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRoute = searchParams.get("next") || "/chat";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setMessage(null);

    if (isSignUp) {
      if (!name.trim()) {
        setErrorMsg("Full name is required.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${nextRoute}`,
          data: {
            full_name: name.trim(),
          },
        },
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setMessage("Check your email to verify your account!");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        router.push(nextRoute);
        router.refresh();
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${nextRoute}`,
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060606] px-4">
      <div className="w-full max-w-sm bg-[#0e0e0e] border border-[#1f1f1f] rounded-3xl p-8 flex flex-col gap-6 shadow-2xl">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center">
          <div className="h-10 w-10 rounded-2xl bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center text-lg mb-3 text-white">
            ⚡
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">CodexForge</h1>
          <p className="text-neutral-500 text-xs mt-1">
            {isSignUp ? "Create your developer account" : "Sign in to your sandboxed workspace"}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-950/20 border border-red-900/30 text-red-400 text-xs leading-relaxed">
            {errorMsg}
          </div>
        )}

        {message && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-xs leading-relaxed">
            {message}
          </div>
        )}        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Full Name</label>
              <input
                type="text"
                placeholder="Dixon Jones"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-black border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neutral-500 transition-colors"
                required={isSignUp}
                disabled={loading}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Email Address</label>
            <input
              type="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neutral-500 transition-colors"
              required
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black border border-[#1f1f1f] rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-neutral-500 transition-colors"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-semibold disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            {loading ? "Authenticating..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#1f1f1f]"></div>
          <span className="flex-shrink mx-4 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">or</span>
          <div className="flex-grow border-t border-[#1f1f1f]"></div>
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2.5 rounded-2xl bg-neutral-900 border border-[#1f1f1f] hover:bg-neutral-800 text-white text-xs font-semibold transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.418 0-6.2-2.782-6.2-6.2s2.782-6.2 6.2-6.2c1.55 0 2.96.57 4.05 1.51l3.05-3.05C19.1 2.38 15.82 1 12.24 1 6.03 1 1 6.03 1 12.24s5.03 11.24 11.24 11.24c6.48 0 10.74-4.56 10.74-10.92 0-.74-.08-1.28-.24-1.28H12.24z"/>
          </svg>
          Continue with Google
        </button>

        {/* Mode Toggle Footer */}
        <div className="text-center text-xs mt-2">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#060606] text-neutral-500 text-xs font-semibold">
        Loading workspace credentials...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
