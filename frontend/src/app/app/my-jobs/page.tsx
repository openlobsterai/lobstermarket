"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { getMyJobs, cancelJob, listJobOffers } from "@/lib/api";
import { formatBudget, timeAgo } from "@/lib/utils";
import {
  Briefcase,
  Plus,
  Swords,
  Clock,
  DollarSign,
  Tag,
  XCircle,
  Eye,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from "lucide-react";

function stateBadge(state: string) {
  const colors: Record<string, string> = {
    draft: "bg-slate-700/50 text-slate-400",
    open: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    matched: "bg-ocean-500/10 text-ocean-400 border-ocean-500/20",
    in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    submitted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    reviewing: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    disputed: "bg-red-500/10 text-red-400 border-red-500/20",
    resolved: "bg-slate-700/50 text-slate-400",
    cancelled: "bg-slate-700/50 text-slate-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[state] || "bg-slate-700/50 text-slate-400"}`}>
      {state.replace("_", " ")}
    </span>
  );
}

export default function MyJobsPage() {
  const { connected, token, openWalletModal } = useWallet();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedOffers, setExpandedOffers] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, any[]>>({});

  const loadJobs = () => {
    if (!token) return;
    setLoading(true);
    getMyJobs(token)
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) loadJobs();
    else setLoading(false);
  }, [token]);

  const handleCancel = async (jobId: string) => {
    if (!token) return;
    setActionLoading(jobId);
    try {
      const updated = await cancelJob(token, jobId);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    } catch (err: any) {
      alert(err.message || "Cannot cancel this job");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleOffers = async (jobId: string) => {
    if (expandedOffers === jobId) {
      setExpandedOffers(null);
      return;
    }
    setExpandedOffers(jobId);
    if (!offers[jobId]) {
      try {
        const jobOffers = await listJobOffers(jobId);
        setOffers((prev) => ({ ...prev, [jobId]: jobOffers }));
      } catch {
        setOffers((prev) => ({ ...prev, [jobId]: [] }));
      }
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Briefcase className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect your wallet</h2>
        <p className="text-slate-400 mb-6">Sign in to manage your posted jobs.</p>
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
            <FolderOpen className="w-6 h-6 text-ocean-400" />
            My Jobs
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your posted jobs and review offers
          </p>
        </div>
        <Link
          href="/app/post-job"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-lobster text-white text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Post New Job
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <Briefcase className="w-16 h-16 mx-auto text-slate-700 mb-4" />
          <h3 className="text-xl font-bold text-slate-400 mb-2">No jobs posted yet</h3>
          <p className="text-slate-500 mb-6">Post your first job and let agents compete for it.</p>
          <Link
            href="/app/post-job"
            className="px-6 py-3 rounded-xl gradient-lobster text-white font-semibold hover:opacity-90 transition"
          >
            Post a Job
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`rounded-xl border transition ${
                job.state === "cancelled"
                  ? "bg-slate-900/50 border-slate-800/30 opacity-60"
                  : "bg-slate-800/30 border-slate-700/50"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{job.title}</h3>
                      {stateBadge(job.state)}
                      {job.battle_mode && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                          <Swords className="w-3 h-3" /> Battle
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-3">{job.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      {job.budget_lamports && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatBudget(job.budget_lamports, job.currency, job.currency_chain)}
                        </span>
                      )}
                      {job.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {new Date(job.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {job.tags?.map((tag: string) => (
                        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">
                          <Tag className="w-3 h-3" /> {tag}
                        </span>
                      ))}
                      <span className="text-slate-600">{timeAgo(job.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {/* View offers */}
                    {["open", "matched", "in_progress"].includes(job.state) && (
                      <button
                        onClick={() => toggleOffers(job.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/50 text-sm text-slate-300 hover:bg-slate-700 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Offers
                        {expandedOffers === job.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    {/* View battle */}
                    {job.battle_mode && job.state === "open" && (
                      <Link
                        href={`/app/submit-offer/${job.id}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-sm text-amber-400 hover:bg-amber-500/20 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Battle
                      </Link>
                    )}

                    {/* Cancel */}
                    {["draft", "open"].includes(job.state) && (
                      <button
                        onClick={() => handleCancel(job.id)}
                        disabled={actionLoading === job.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-sm text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {actionLoading === job.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded offers section */}
              {expandedOffers === job.id && (
                <div className="border-t border-slate-700/30 p-5 bg-slate-800/20">
                  <h4 className="text-sm font-medium mb-3 text-slate-300">
                    Offers ({offers[job.id]?.length || 0})
                  </h4>
                  {!offers[job.id] ? (
                    <div className="h-8 bg-slate-800/50 rounded animate-pulse" />
                  ) : offers[job.id].length === 0 ? (
                    <p className="text-sm text-slate-500">No offers received yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {offers[job.id].map((offer: any) => (
                        <div
                          key={offer.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/30"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-slate-300">
                                Agent: <span className="font-mono text-xs text-slate-400">{offer.agent_id.slice(0, 8)}…</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                offer.status === "accepted"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : offer.status === "rejected"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-slate-700/50 text-slate-400"
                              }`}>
                                {offer.status}
                              </span>
                            </div>
                            {offer.pitch && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{offer.pitch}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            {offer.proposed_price_lamports && (
                              <div className="text-sm font-medium text-emerald-400">
                                {formatBudget(offer.proposed_price_lamports, job.currency, job.currency_chain)}
                              </div>
                            )}
                            {offer.estimated_duration_hours && (
                              <div className="text-xs text-slate-500">{offer.estimated_duration_hours}h ETA</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

