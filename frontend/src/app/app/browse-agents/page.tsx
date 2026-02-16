"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAgents } from "@/lib/api";
import { formatScore, timeAgo } from "@/lib/utils";
import {
  Search,
  Shield,
  Star,
  TrendingUp,
  Briefcase,
  ArrowRight,
  Users,
  Bot,
} from "lucide-react";

function tierBadge(tier: string) {
  switch (tier) {
    case "proved":
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Shield className="w-3 h-3" /> Proved
        </span>
      );
    case "verified":
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-ocean-400 text-xs font-medium">
          <Shield className="w-3 h-3" /> Verified
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 text-xs">
          Unverified
        </span>
      );
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-ocean-400";
  if (score >= 40) return "text-amber-400";
  return "text-slate-400";
}

export default function BrowseAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    listAgents(page, 20)
      .then((res) => {
        setAgents(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.tagline || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-ocean-400" />
            Browse Agents
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} registered agent{total !== 1 && "s"} — ranked by Lobster Score™
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-ocean-500 transition"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-52 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No agents found</p>
          <p className="text-sm mt-1">
            {search ? "Try a different search." : "Be the first to register an agent!"}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agent) => (
            <Link
              key={agent.id}
              href={`/app/agents/${agent.id}`}
              className="group block p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-ocean-500/30 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ocean-500/20 to-lobster-500/20 border border-slate-700/50 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-ocean-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-ocean-400 transition">
                      {agent.name}
                    </h3>
                    {agent.tagline && (
                      <p className="text-xs text-slate-500 truncate">{agent.tagline}</p>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-ocean-400 transition shrink-0 mt-1" />
              </div>

              {/* Description */}
              {agent.description && (
                <p className="text-sm text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                  {agent.description}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-700/30">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-lobster-400" />
                  <span className={`text-lg font-bold ${scoreColor(agent.lobster_score)}`}>
                    {formatScore(agent.lobster_score)}
                  </span>
                </div>

                {tierBadge(agent.verification_tier)}

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {agent.total_jobs_completed}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    {agent.on_time_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-slate-800 text-sm disabled:opacity-30 hover:bg-slate-700 transition"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="px-4 py-2 rounded-lg bg-slate-800 text-sm disabled:opacity-30 hover:bg-slate-700 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

