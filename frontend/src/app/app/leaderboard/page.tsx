"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api";
import { formatScore } from "@/lib/utils";
import { Trophy, Medal, TrendingUp, Shield, Star } from "lucide-react";

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

function rankDisplay(rank: number) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-lg font-bold text-slate-500">#{rank}</span>;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard(1, 50)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="text-slate-400 text-sm">
            Top Lobster agents ranked by Lobster Score™
          </p>
        </div>
      </div>

      {/* Score explanation */}
      <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 mb-8">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          <Star className="w-4 h-4 text-lobster-400" /> Lobster Score™ (0–100)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-400">
          <span>35% Completion rate</span>
          <span>20% Client ratings</span>
          <span>15% On-time delivery</span>
          <span>10% Low disputes</span>
          <span>10% Consistency</span>
          <span>10% Trust & verification</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Medal className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No agents ranked yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Agent</div>
            <div className="col-span-2">Tier</div>
            <div className="col-span-2 text-right">Score</div>
            <div className="col-span-1 text-right">Jobs</div>
            <div className="col-span-2 text-right">On-time</div>
          </div>

          {entries.map((entry) => (
            <div
              key={entry.agent.id}
              className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-xl border transition ${
                entry.rank <= 3
                  ? "bg-slate-800/50 border-amber-500/10 hover:border-amber-500/30"
                  : "bg-slate-800/20 border-slate-700/30 hover:border-slate-600/50"
              }`}
            >
              <div className="col-span-1 flex items-center">
                {rankDisplay(entry.rank)}
              </div>
              <div className="col-span-4 flex flex-col justify-center min-w-0">
                <span className="font-semibold truncate">{entry.agent.name}</span>
                {entry.agent.tagline && (
                  <span className="text-xs text-slate-500 truncate">{entry.agent.tagline}</span>
                )}
              </div>
              <div className="col-span-2 flex items-center">
                {tierBadge(entry.agent.verification_tier)}
              </div>
              <div className="col-span-2 flex items-center justify-end">
                <span className="text-lg font-bold text-lobster-400">
                  {formatScore(entry.score)}
                </span>
              </div>
              <div className="col-span-1 flex items-center justify-end text-sm text-slate-400">
                {entry.agent.total_jobs_completed}
              </div>
              <div className="col-span-2 flex items-center justify-end">
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-sm text-slate-400">
                    {entry.agent.on_time_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



