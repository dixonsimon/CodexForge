"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Modal states
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      const u = res?.data?.user;
      if (u) {
        setUser(u);
        // Fetch debug info from local endpoint
        fetch("/api/v1/debug")
          .then((res) => res.json())
          .then((data) => setDebugInfo(data))
          .catch(() => {});
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
  }, [router, supabase.auth]);

  const handleDeleteData = async () => {
    setIsDeletingData(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/v1/user/delete-data", {
        method: "POST",
      });
      if (response.ok) {
        setShowDeleteDataModal(false);
        alert("All your conversations, API keys, and file locks have been successfully deleted.");
        // Refresh dynamic counter
        fetch("/api/v1/debug")
          .then((res) => res.json())
          .then((data) => setDebugInfo(data))
          .catch(() => {});
        router.refresh();
      } else {
        const err = await response.json();
        setErrorMessage(err.error || "Failed to delete user data.");
      }
    } catch (e) {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/v1/user/delete-account", {
        method: "POST",
      });
      if (response.ok) {
        await supabase.auth.signOut();
        setShowDeleteAccountModal(false);
        router.push("/login");
      } else {
        const err = await response.json();
        setErrorMessage(err.error || "Failed to delete account.");
      }
    } catch (e) {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060606] text-neutral-400 text-xs font-semibold">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial = (user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#060606] py-12 px-6 sm:px-12 flex justify-center items-start overflow-y-auto select-none animate-fade-in">
      <div className="w-full max-w-5xl flex flex-col gap-10">
        
        {/* Profile Header */}
        <div className="flex items-center gap-4 pb-6 border-b border-[#1f1f1f]">
          {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
            <img
              src={user.user_metadata.avatar_url || user.user_metadata.picture}
              alt="Avatar"
              className="h-12 w-12 rounded-full border border-[#222] object-cover shadow-lg"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-neutral-900 border border-[#222] flex items-center justify-center text-sm font-bold text-white uppercase font-mono shadow-lg">
              {userInitial}
            </div>
          )}
          <div className="flex-grow">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              {user.user_metadata?.full_name || "Profile"}
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5 font-mono">{user.email}</p>
          </div>
          <div className="px-2.5 py-0.5 rounded-full bg-neutral-900/60 border border-[#1f1f1f] text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
            Sandbox
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-red-950/30 border border-red-900/40 rounded-xl text-red-400 text-xs leading-relaxed animate-shake">
            {errorMessage}
          </div>
        )}

        {/* Two Column Layout for Full Screen Utilization */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          
          {/* Left Column - Account Information */}
          <div className="md:col-span-1 flex flex-col gap-6">
            <div className="border-b border-[#1f1f1f] pb-3">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Account Info</h2>
              <p className="text-neutral-500 text-[11px] mt-0.5">Your core identity details.</p>
            </div>
            
            <div className="flex flex-col text-xs gap-3">
              <div className="flex flex-col gap-1 py-2 border-b border-[#121212]">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">User ID</span>
                <span className="text-neutral-400 font-mono select-all truncate" title={user.id}>{user.id}</span>
              </div>
              <div className="flex flex-col gap-1 py-2 border-b border-[#121212]">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Sign-in Provider</span>
                <span className="text-neutral-200 capitalize">{user.app_metadata?.provider || "Supabase Auth"}</span>
              </div>
              <div className="flex flex-col gap-1 py-2 border-b border-[#121212]">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Last Sign-in</span>
                <span className="text-neutral-200 font-mono">
                  {new Date(user.last_sign_in_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex flex-col gap-1 py-2">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Member Since</span>
                <span className="text-neutral-200 font-mono">
                  {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - System Diagnostics & Data Controls */}
          <div className="md:col-span-2 flex flex-col gap-10">
            
            {/* System Status / Diagnostics */}
            <div className="flex flex-col gap-5">
              <div className="border-b border-[#1f1f1f] pb-3">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">System & Diagnostics</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5 font-normal">Real-time status of service integrations and databases.</p>
              </div>
              
              <div className="flex flex-col text-xs">
                <div className="flex items-center justify-between py-3.5 border-b border-[#121212]">
                  <span className="text-neutral-400">Database Connection</span>
                  {debugInfo ? (
                    debugInfo.dbConnection === "Success" ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Connected
                      </span>
                    ) : (
                      <span className="text-red-400 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Connection Failed
                      </span>
                    )
                  ) : (
                    <span className="text-neutral-500">Checking...</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-3.5 border-b border-[#121212]">
                  <span className="text-neutral-400">Database URL Configuration</span>
                  <span className="text-neutral-200 font-semibold">
                    {debugInfo ? (debugInfo.hasDatabaseUrl ? "Active" : "Missing (Check Vercel Env)") : "Checking..."}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3.5 border-b border-[#121212]">
                  <span className="text-neutral-400">Gemini LLM Key Status</span>
                  <span className="text-neutral-200 font-semibold">
                    {debugInfo ? (debugInfo.hasGeminiKey ? "Connected" : "Offline") : "Checking..."}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3.5">
                  <span className="text-neutral-400">Database Counters</span>
                  <span className="text-neutral-300 font-mono text-[11px]">
                    {debugInfo 
                      ? `Chats: ${debugInfo.prismaConversationCount ?? 0} | Messages: ${debugInfo.prismaMessageCount ?? 0}`
                      : "Checking..."}
                  </span>
                </div>
              </div>
            </div>

            {/* Data & History controls */}
            <div className="flex flex-col gap-5">
              <div className="border-b border-[#1f1f1f] pb-3">
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Data Controls</h2>
                <p className="text-neutral-500 text-[11px] mt-0.5 font-normal">Manage your personal data and conversation history.</p>
              </div>
              
              <div className="flex flex-col text-xs">
                <div className="flex items-center justify-between py-3.5 border-b border-[#121212]">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-neutral-200 font-semibold">Delete all data</span>
                    <span className="text-neutral-500 text-[11px]">Permanently clear your conversations and active keys.</span>
                  </div>
                  <button
                    onClick={() => setShowDeleteDataModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-[#1f1f1f] hover:border-red-900/60 bg-neutral-900/20 hover:bg-red-950/10 text-neutral-300 hover:text-red-400 font-semibold transition-all active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    Delete Data
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-neutral-200 font-semibold">Delete account</span>
                    <span className="text-neutral-500 text-[11px]">Permanently delete your profile and close the account.</span>
                  </div>
                  <button
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-red-950/40 hover:border-red-500 bg-red-950/20 hover:bg-red-950/50 text-red-400 font-semibold transition-all active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Delete Data Confirmation Modal */}
      {showDeleteDataModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm z-[200] p-4 select-none animate-fade-in">
          <div className="bg-[#0e0e0e] border border-[#222] rounded-2xl max-w-sm w-full p-5 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Confirm Data Deletion</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              This will permanently delete all your conversation history, saved API keys, and workspace locks. This action cannot be undone.
            </p>
            <div className="flex gap-2.5 justify-end mt-1">
              <button
                onClick={() => setShowDeleteDataModal(false)}
                disabled={isDeletingData}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={isDeletingData}
                className="px-3 py-1.5 rounded-lg bg-red-950/50 text-red-400 hover:bg-red-900 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                {isDeletingData ? "Deleting..." : "Delete Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm z-[200] p-4 select-none animate-fade-in">
          <div className="bg-[#0e0e0e] border border-[#222] rounded-2xl max-w-sm w-full p-5 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider">Confirm Account Deletion</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              This will permanently erase your profile and all associated data. You will be signed out immediately and this cannot be reversed.
            </p>
            <div className="flex gap-2.5 justify-end mt-1">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-black text-xs font-semibold transition-all cursor-pointer"
              >
                {isDeletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
