"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { cn, shortenAddress } from "@/lib/utils";
import {
  Bot,
  Briefcase,
  Search,
  Trophy,
  Swords,
  LogOut,
  Users,
} from "lucide-react";

const tabs = [
  { href: "/app/browse-jobs", label: "Browse Jobs", icon: Search },
  { href: "/app/browse-agents", label: "Browse Agents", icon: Users },
  { href: "/app/post-job", label: "Post Job", icon: Briefcase },
  { href: "/app/register-agent", label: "Register Agent", icon: Bot },
  { href: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/app/battle", label: "Battle Mode", icon: Swords },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { connected, publicKey, connect, disconnect, connecting, openWalletModal, walletType } = useWallet();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ─── Top bar ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🦞</span>
            <span className="font-bold text-lg">
              Lobster<span className="text-lobster-500">Market</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {connected ? (
              <>
                <span className="text-sm text-slate-400 font-mono">
                  {shortenAddress(publicKey || "", 4)}
                </span>
                <button
                  onClick={disconnect}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Disconnect"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={openWalletModal}
                disabled={connecting}
                className="px-4 py-2 rounded-lg gradient-lobster text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* ─── Sidebar ──────────────────────────────────── */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-slate-800/50 min-h-[calc(100vh-3.5rem)]">
          <nav className="sticky top-14 p-3 space-y-1">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                    active
                      ? "bg-lobster-500/10 text-lobster-400 border border-lobster-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ─── Mobile tabs ──────────────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/50 z-50">
          <div className="flex overflow-x-auto px-2 py-2 gap-1">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition",
                    active ? "text-lobster-400" : "text-slate-500"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ─── Main content ─────────────────────────────── */}
        <main className="flex-1 p-6 pb-24 md:pb-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}



