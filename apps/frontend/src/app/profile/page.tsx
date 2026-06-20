"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbUser, setDbUser] = useState<any>(null);
  
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
        // Fetch database details if necessary
        fetch(`/api/v1/organizations`) // just to fetch orgs/metadata or check connection
          .then((res) => res.json())
          .then((data) => {
            // Can extract some info if needed
          })
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
        // Sign out from Supabase client-side
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
      <div className="w-full max-w-xl flex flex-col gap-10">
        
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

        {/* Account Info Section */}
        <div className="flex flex-col gap-5">
          <div className="border-b border-[#1f1f1f] pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Account</h2>
            <p className="text-neutral-500 text-[11px] mt-0.5">Manage your profile details and settings.</p>
          </div>
          
          <div className="flex flex-col text-xs">
            <div className="flex items-center justify-between py-3 border-b border-[#121212]">
              <span className="text-neutral-400">User ID</span>
              <span className="text-neutral-400 font-mono select-all truncate max-w-[200px]" title={user.id}>{user.id}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#121212]">
              <span className="text-neutral-400">Sign-in Provider</span>
              <span className="text-neutral-200 capitalize">{user.app_metadata?.provider || "Supabase Auth"}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#121212]">
              <span className="text-neutral-400">Last Sign-in</span>
              <span className="text-neutral-200 font-mono">
                {new Date(user.last_sign_in_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-neutral-400">Member Since</span>
              <span className="text-neutral-200 font-mono">
                {new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Data & History controls */}
        <div className="flex flex-col gap-5">
          <div className="border-b border-[#1f1f1f] pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Data Controls</h2>
            <p className="text-neutral-500 text-[11px] mt-0.5 font-normal">Manage your personal data, saved keys and conversation history.</p>
          </div>
          
          <div className="flex flex-col text-xs">
            <div className="flex items-center justify-between py-3.5 border-b border-[#121212]">
              <div className="flex flex-col gap-0.5">
                <span className="text-neutral-200 font-semibold">Delete all data</span>
                <span className="text-neutral-500 text-[11px]">Permanently clear your conversations and active keys.</span>
              </div>
              <button
                onClick={() => setShowDeleteDataModal(true)}
                className="px-3 py-1.5 rounded-lg border border-[#1f1f1f] hover:border-red-900/60 bg-neutral-900/20 hover:bg-red-950/10 text-neutral-300 hover:text-red-400 font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Delete Data
              </button>
            </div>
            
            <div className="flex items-center justify-between py-3.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-neutral-200 font-semibold">Delete account</span>
                <span className="text-neutral-500 text-[11px]">Permanently delete your profile and close the account.</span>
              </div>
              <button
                onClick={() => setShowDeleteAccountModal(true)}
                className="px-3 py-1.5 rounded-lg border border-red-950/40 hover:border-red-500 bg-red-950/20 hover:bg-red-950/50 text-red-400 font-semibold transition-all active:scale-95 cursor-pointer"
              >
                Delete Account
              </button>
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
