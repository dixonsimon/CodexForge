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
      <div className="flex items-center justify-center min-h-screen bg-[#060606] text-neutral-450 text-xs font-semibold">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your developer profile...
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitial = (user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#060606] py-12 px-6 sm:px-12 flex justify-center items-start overflow-y-auto select-none animate-fade-in">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-[#1f1f1f]">
          {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
            <img
              src={user.user_metadata.avatar_url || user.user_metadata.picture}
              alt="Avatar"
              className="h-16 w-16 rounded-3xl border border-[#222] object-cover shadow-lg"
            />
          ) : (
            <div className="h-16 w-16 rounded-3xl bg-neutral-900 border border-[#222] flex items-center justify-center text-xl font-bold text-white uppercase font-mono shadow-lg">
              {userInitial}
            </div>
          )}
          <div className="text-center sm:text-left flex-grow">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {user.user_metadata?.full_name || "Developer Profile"}
            </h1>
            <p className="text-neutral-500 text-xs mt-1 font-mono">{user.email}</p>
          </div>
          <div className="px-3 py-1 rounded-xl bg-neutral-900 border border-[#1f1f1f] text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
            Free Sandbox tier
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-red-950/40 border border-red-900/60 rounded-2xl text-red-400 text-xs leading-relaxed animate-shake">
            {errorMessage}
          </div>
        )}

        {/* Profile Settings Card */}
        <div className="bg-[#0c0c0c] border border-[#1f1f1f] rounded-3xl p-6 flex flex-col gap-6 shadow-xl shadow-black/40">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Account Metadata</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">User Identity Identifier</span>
              <span className="text-neutral-300 font-mono select-all truncate">{user.id}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Registration Source</span>
              <span className="text-neutral-300 capitalize">{user.app_metadata?.provider || "Supabase Auth"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Last Sign-in Session</span>
              <span className="text-neutral-300 font-mono">
                {new Date(user.last_sign_in_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Account Created</span>
              <span className="text-neutral-300 font-mono">
                {new Date(user.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone Card */}
        <div className="bg-[#0c0c0c] border border-red-950/40 rounded-3xl p-6 flex flex-col gap-6 shadow-xl shadow-black/40">
          <div className="flex items-center gap-2">
            <span className="text-xs">⚠️</span>
            <h2 className="text-sm font-bold text-red-500 uppercase tracking-wider">Danger Zone</h2>
          </div>
          
          <p className="text-neutral-500 text-xs leading-relaxed">
            These actions permanently destroy data. They are non-reversible. Please proceed with caution.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-2">
            <button
              onClick={() => setShowDeleteDataModal(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-neutral-900/40 hover:bg-red-950/20 text-neutral-350 hover:text-red-400 border border-[#1f1f1f] hover:border-red-900/60 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              Delete All My Data
            </button>
            <button
              onClick={() => setShowDeleteAccountModal(true)}
              className="flex-grow py-3 px-4 rounded-2xl bg-red-950/30 hover:bg-red-950/60 text-red-400 border border-red-900/60 hover:border-red-600 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              Delete My Account
            </button>
          </div>
        </div>

      </div>

      {/* Delete Data Confirmation Modal */}
      {showDeleteDataModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[200] p-4 select-none animate-fade-in">
          <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Data Deletion</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              This action will permanently delete all your chats, saved messages, active file locks, and generated API keys from our database. You cannot undo this.
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setShowDeleteDataModal(false)}
                disabled={isDeletingData}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={isDeletingData}
                className="px-4 py-2 rounded-xl bg-red-950 text-red-400 hover:bg-red-900 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingData ? "Deleting..." : "Yes, Delete Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[200] p-4 select-none animate-fade-in">
          <div className="bg-[#0e0e0e] border border-[#222] rounded-3xl max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl">
            <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider">Confirm Account Deletion</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              This will erase your database user profile and all associated data, then sign you out. Your local workspace history will be gone forever.
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-black text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingAccount ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
