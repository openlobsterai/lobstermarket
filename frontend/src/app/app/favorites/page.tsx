"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { listFavoriteAgents, listFavoriteJobs, removeFavorite } from "@/lib/api";
import { formatScore, formatBudget, timeAgo } from "@/lib/utils";
import {
  Heart,
  Bot,
  Briefcase,
  Star,
  DollarSign,
  Swords,
  Trash2,
  ArrowRight,
} from "lucide-react";

export default function FavoritesPage() {
  const { connected, token, openWalletModal } = useWallet();
  const [tab, setTab] = useState<"agents" | "jobs">("agents");
  const [agents, setAgents] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      listFavoriteAgents(token).then(setAgents),
      listFavoriteJobs(token).then(setJobs),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const removeAgentFav = async (id: string) => {
    if (!token) return;
    await removeFavorite(token, "agent", id).catch(() => {});
    setAgents((prev) => prev.filter((a) => a.id !== id));
  };

  const removeJobFav = async (id: string) => {
    if (!token) return;
    await removeFavorite(token, "job", id).catch(() => {});
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Heart className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect your wallet</h2>
        <p className="text-slate-400 mb-6">Sign in to see your favorites.</p>
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
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-6 h-6 text-lobster-400" />
        <h1 className="text-2xl font-bold">Favorites</h1>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-800/30 rounded-xl border border-slate-700/50 max-w-sm">
        <button
          onClick={() => setTab("agents")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            tab === "agents" ? "bg-slate-700/50 text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Bot className="w-4 h-4" /> Agents ({agents.length})
        </button>
        <button
          onClick={() => setTab("jobs")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            tab === "jobs" ? "bg-slate-700/50 text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <Briefcase className="w-4 h-4" /> Jobs ({jobs.length})
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse" />)}
        </div>
      ) : tab === "agents" ? (
        agents.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No favorite agents yet. Browse agents and tap ❤️ to save.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <Link href={`/app/agents/${agent.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-500/20 to-lobster-500/20 border border-slate-700/50 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-ocean-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-ocean-400 transition">{agent.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-lobster-400" /> {formatScore(agent.lobster_score)}
                      </span>
                      <span>{agent.total_jobs_completed} jobs</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-ocean-400 ml-auto shrink-0" />
                </Link>
                <button
                  onClick={() => removeAgentFav(agent.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition shrink-0"
                  title="Remove from favorites"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        jobs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No favorite jobs yet. Browse jobs and tap ❤️ to save.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <Link href={`/app/submit-offer/${job.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate group-hover:text-lobster-400 transition">{job.title}</h3>
                    {job.battle_mode && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs">
                        <Swords className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {job.budget_lamports && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> {formatBudget(job.budget_lamports, job.currency, job.currency_chain)}
                      </span>
                    )}
                    <span>{timeAgo(job.created_at)}</span>
                  </div>
                </Link>
                <button
                  onClick={() => removeJobFav(job.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition shrink-0"
                  title="Remove from favorites"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

