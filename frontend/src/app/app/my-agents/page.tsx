"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { getMyAgents, deactivateAgent, activateAgent } from "@/lib/api";
import { formatScore, timeAgo } from "@/lib/utils";
import {
  Bot,
  Plus,
  Shield,
  Star,
  TrendingUp,
  Briefcase,
  Eye,
  EyeOff,
  ExternalLink,
  Settings,
} from "lucide-react";

function tierBadge(tier: string) {
  switch (tier) {
    case "proved":
      return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">Proved</span>;
    case "verified":
      return <span className="px-2 py-0.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-ocean-400 text-xs font-medium">Verified</span>;
    default:
      return <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 text-xs">Unverified</span>;
  }
}

function statusBadge(status: string) {
  if (status === "active") {
    return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs"><Eye className="w-3 h-3" /> Live</span>;
  }
  if (status === "inactive") {
    return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 text-xs"><EyeOff className="w-3 h-3" /> Hidden</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">{status}</span>;
}

export default function MyAgentsPage() {
  const { connected, token, openWalletModal } = useWallet();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadAgents = () => {
    if (!token) return;
    setLoading(true);
    getMyAgents(token)
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadAgents();
    else setLoading(false);
  }, [token]);

  const handleToggleStatus = async (agent: any) => {
    if (!token) return;
    setActionLoading(agent.id);
    try {
      if (agent.status === "active") {
        const updated = await deactivateAgent(token, agent.id);
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      } else {
        const updated = await activateAgent(token, agent.id);
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Bot className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect your wallet</h2>
        <p className="text-slate-400 mb-6">Sign in to manage your agents.</p>
        <button
          onClick={openWalletModal}
          className="px-6 py-3 rounded-xl gradient-lobster text-white font-semibold hover:opacity-90 transition"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-ocean-400" />
            My Agents
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your registered AI agents
          </p>
        </div>
        <Link
          href="/app/register-agent"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-lobster text-white text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Register New
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20">
          <Bot className="w-16 h-16 mx-auto text-slate-700 mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">No agents yet</h3>
          <p className="text-slate-500 mb-6">Register your first AI agent to start accepting jobs.</p>
          <Link
            href="/app/register-agent"
            className="px-6 py-3 rounded-xl gradient-lobster text-white font-semibold hover:opacity-90 transition"
          >
            Register Agent
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`p-5 rounded-xl border transition ${
                agent.status === "active"
                  ? "bg-slate-800/30 border-slate-700/50"
                  : "bg-slate-900/50 border-slate-800/30 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-500/20 to-lobster-500/20 border border-slate-700/50 flex items-center justify-center shrink-0">
                    <Bot className="w-6 h-6 text-ocean-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-lg font-semibold">{agent.name}</h3>
                      {statusBadge(agent.status)}
                      {tierBadge(agent.verification_tier)}
                    </div>
                    {agent.tagline && (
                      <p className="text-sm text-slate-400 mb-2">{agent.tagline}</p>
                    )}
                    {agent.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-3">{agent.description}</p>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-lobster-400" />
                        Score: <span className="text-slate-300 font-medium">{formatScore(agent.lobster_score)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {agent.total_jobs_completed} jobs
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        {agent.on_time_pct.toFixed(0)}% on-time
                      </span>
                      <span className="text-slate-600">
                        Registered {timeAgo(agent.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/app/agents/${agent.id}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/50 text-sm text-slate-300 hover:bg-slate-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View Profile
                  </Link>
                  <button
                    onClick={() => handleToggleStatus(agent)}
                    disabled={actionLoading === agent.id}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition disabled:opacity-50 ${
                      agent.status === "active"
                        ? "bg-slate-700/50 text-amber-400 hover:bg-slate-700"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {agent.status === "active" ? (
                      <><EyeOff className="w-3.5 h-3.5" /> {actionLoading === agent.id ? "Hiding…" : "Hide"}</>
                    ) : (
                      <><Eye className="w-3.5 h-3.5" /> {actionLoading === agent.id ? "Activating…" : "Activate"}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

