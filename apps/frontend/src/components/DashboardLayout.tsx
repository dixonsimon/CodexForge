"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { createClient } from "@/utils/supabase/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  initialUser: any;
}

export default function DashboardLayout({ children, initialUser }: DashboardLayoutProps) {
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<any>(initialUser);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const {
    conversations,
    activeConversationId,
    handleSelectConversation,
    handleNewSession,
    handleDeleteConversation,
    handleRenameConversation,
    isSyncing,
    syncStatus,
    handleSyncIndex,
  } = useSidebar();

  useEffect(() => {
    if (!initialUser) {
      supabase.auth.getUser().then((res: any) => {
        const u = res?.data?.user;
        if (u) setUser(u);
      });
    } else {
      setUser(initialUser);
    }
  }, [initialUser]);

  const isChatRoute = pathname?.startsWith("/chat");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Determine if it is a public/unauthenticated landing or utility page.
  const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/terms" || pathname === "/privacy";

  // If there's no logged-in user session, or it's a public layout, render standard main container.
  if (!user || isPublicPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen bg-[#060606] text-[#f5f5f5] font-sans antialiased overflow-hidden relative">
      
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Dynamic Left Navigation Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 border-r border-[#1f1f1f] bg-[#0c0c0c] flex flex-col justify-between flex-shrink-0 select-none z-50 transition-transform duration-300 ease-in-out ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        
        {/* Top Section */}
        <div className="flex flex-col gap-5 p-5 overflow-y-auto flex-1 scrollbar-none">
          {/* Logo Header */}
          <div className="flex items-center justify-between w-full">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-xl bg-neutral-900 border border-[#262626] flex items-center justify-center transition-all group-hover:bg-neutral-800">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-semibold text-sm tracking-tight text-white transition-colors">
                CodexForge
              </span>
            </Link>
            
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1.5 rounded-xl border border-[#1f1f1f] hover:bg-neutral-900 text-neutral-450 hover:text-white transition-colors"
              title="Close Menu"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === "/dashboard"
                  ? "bg-white text-black font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/chat"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isChatRoute
                  ? "bg-white text-black font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Chat Assistant
            </Link>
            <Link
              href="/keys"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === "/keys"
                  ? "bg-white text-black font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m0 0a2 2 0 01-2 2m2-2a2 2 0 00-2-2m2 2a2 2 0 00-2 2m0 0a2 2 0 01-2-2m2 2a2 2 0 01-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2m0 10a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2m0 0a2 2 0 012-2h2a2 2 0 012 2v2m0 0V19a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2" />
              </svg>
              API Keys
            </Link>
            <Link
              href="/projects"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === "/projects"
                  ? "bg-white text-black font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Projects & Teams
            </Link>
            <Link
              href="/docs"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname?.startsWith("/docs")
                  ? "bg-white text-black font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Documentation
            </Link>
            <Link
              href="/profile"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                pathname === "/profile"
                  ? "bg-white text-black font-semibold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Link>
          </nav>

          {/* Conditional Chat Section (Recent Chats & RAG indexer sync buttons) */}
          {isChatRoute && (
            <div className="flex flex-col gap-4 border-t border-[#1f1f1f] pt-4 mt-1 flex-1 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Recent Chats
                </span>
                <button
                  onClick={handleNewSession}
                  className="p-1 rounded-xl bg-neutral-900 border border-[#1f1f1f] hover:bg-neutral-800 text-white transition-all active:scale-95 flex items-center justify-center"
                  title="New Chat"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Chat Thread Item List */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0 scrollbar-thin">
                {conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                      activeConversationId === c.id
                        ? "bg-neutral-900 border-[#1f1f1f] text-white"
                        : "border-transparent text-neutral-400 hover:text-white hover:bg-neutral-900/50"
                    }`}
                  >
                    {editingId === c.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => {
                          if (editTitle.trim() && editTitle.trim() !== c.title) {
                            handleRenameConversation(c.id, editTitle.trim());
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            if (editTitle.trim() && editTitle.trim() !== c.title) {
                              handleRenameConversation(c.id, editTitle.trim());
                            }
                            setEditingId(null);
                          } else if (e.key === "Escape") {
                            e.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-black border border-neutral-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-neutral-500 mr-2"
                      />
                    ) : (
                      <span className="truncate flex-1 pr-2">{c.title}</span>
                    )}

                    {editingId !== c.id && (
                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(c.id);
                            setEditTitle(c.title);
                          }}
                          className="opacity-0 group-hover:opacity-100 hover:text-amber-400 p-0.5 rounded transition-all mr-1"
                          title="Rename Thread"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteConversation(c.id, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-all"
                          title="Delete Thread"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {conversations.length === 0 && (
                  <span className="text-[10px] text-neutral-600 text-center py-4 font-semibold">No active chats</span>
                )}
              </div>

              {/* Workspace RAG Sync Panel */}
              <div className="flex flex-col gap-2 border-t border-[#1f1f1f] pt-4 mt-auto">
                <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Workspace Index (RAG)
                </span>
                <div className="bg-[#060606] border border-[#1f1f1f] rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400 font-semibold">Status</span>
                    <span className={`text-[10px] font-bold ${isSyncing ? "text-yellow-500" : syncStatus === "Indexed" ? "text-emerald-500" : "text-neutral-500"}`}>
                      {isSyncing ? "Syncing..." : syncStatus}
                    </span>
                  </div>
                  <button
                    onClick={handleSyncIndex}
                    disabled={isSyncing}
                    className="w-full py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-[10px] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    {isSyncing ? "Indexing..." : "Sync Index"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section (Terms, Privacy, User Metadata, Sign Out) */}
        <div className="p-4 border-t border-[#1f1f1f] bg-[#080808] flex flex-col gap-4">
          {/* Compliance Links */}
          <div className="flex justify-around text-[10px] text-neutral-500 font-semibold">
            <Link href="/terms" className="hover:text-neutral-400 transition-colors">
              Terms
            </Link>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-neutral-400 transition-colors">
              Privacy
            </Link>
          </div>

          {/* User Profile and Sign Out Container */}
          <div className="flex items-center justify-between bg-black border border-[#1f1f1f] p-2.5 rounded-2xl">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {(user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                <img
                  src={user.user_metadata.avatar_url || user.user_metadata.picture}
                  alt="Avatar"
                  className="h-7 w-7 rounded-full border border-[#1f1f1f] object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center text-[10px] font-bold text-white uppercase font-mono flex-shrink-0">
                  {(user.user_metadata?.full_name || user.email || "?").charAt(0)}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] font-bold text-white truncate">
                  {user.user_metadata?.full_name || "Developer"}
                </span>
                <span className="text-[9px] text-neutral-500 truncate font-mono">
                  {user.email}
                </span>
              </div>
            </div>

            {/* Sign Out Action */}
            <form action="/api/auth/signout" method="POST" className="flex-shrink-0 ml-1">
              <button
                type="submit"
                className="p-1.5 rounded-lg border border-[#1f1f1f] bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all active:scale-95 flex items-center justify-center"
                title="Sign Out"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>

      </aside>
      
      {/* Main Panel Content Container */}
      <main className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-[#060606] relative">
        
        {/* Mobile Header Bar */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-[#1f1f1f] bg-[#0c0c0c] z-30 select-none flex-shrink-0">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-xl border border-[#1f1f1f] hover:bg-neutral-900 text-white active:scale-95 transition-all"
            title="Open Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <span className="font-semibold text-xs tracking-tight text-white">
            CodexForge
          </span>
          
          <div className="h-7 w-7 rounded-full bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center text-[10px] font-bold text-white uppercase font-mono">
            {(user.user_metadata?.full_name || user.email || "?").charAt(0)}
          </div>
        </header>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto min-h-0 relative animate-fade-in" key={pathname}>
          {children}
        </div>
      </main>

    </div>
  );
}
