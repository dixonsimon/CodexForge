import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getAuthenticatedUser } from "@/utils/supabase/auth";
import { SidebarProvider } from "@/context/SidebarContext";
import DashboardLayout from "@/components/DashboardLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodexForge",
  description: "Simplistic Developer Assistant & Sandboxed Workspace.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-[#060606] text-[#f5f5f5] font-sans antialiased selection:bg-neutral-800 selection:text-white scrollbar-none">
        <SidebarProvider>
          {/* Public top navbar for unauthenticated sessions */}
          {!user && (
            <header className="w-full border-b border-[#1f1f1f] bg-[#060606]/90 sticky top-0 z-50 backdrop-blur-md">
              <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-neutral-900 border border-[#1f1f1f] flex items-center justify-center text-xs text-white">
                    ⚡
                  </div>
                  <span className="font-semibold text-sm tracking-tight text-white">CodexForge</span>
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-xl border border-[#1f1f1f] bg-neutral-950 text-neutral-300 text-xs font-semibold hover:bg-neutral-900 hover:text-white transition-all active:scale-95"
                >
                  Sign In
                </Link>
              </div>
            </header>
          )}

          <DashboardLayout initialUser={user ? JSON.parse(JSON.stringify(user)) : null}>
            {children}
          </DashboardLayout>
        </SidebarProvider>
      </body>
    </html>
  );
}
