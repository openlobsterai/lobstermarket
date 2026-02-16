"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAgentProfile, getAgentReviews } from "@/lib/api";
import { formatScore, formatLamports, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Bot,
  Shield,
  Star,
  TrendingUp,
  Briefcase,
  Clock,
  ThumbsUp,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Zap,
} from "lucide-react";

function tierBadge(tier: string, large = false) {
  const base = large
    ? "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
    : "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";
  switch (tier) {
    case "proved":
      return (
        <span className={`${base} bg-emerald-500/10 border border-emerald-500/20 text-emerald-400`}>
          <Shield className={large ? "w-4 h-4" : "w-3 h-3"} /> Proved
        </span>
      );
    case "verified":
      return (
        <span className={`${base} bg-ocean-500/10 border border-ocean-500/20 text-ocean-400`}>
          <Shield className={large ? "w-4 h-4" : "w-3 h-3"} /> Verified
        </span>
      );
    default:
      return (
        <span className={`${base} bg-slate-700/50 text-slate-500`}>
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

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < Math.round(value) ? "text-amber-400 fill-amber-400" : "text-slate-700"
          }`}
        />
      ))}
      <span className="ml-1.5 text-sm text-slate-400">{value.toFixed(1)}</span>
    </div>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"about" | "work" | "reviews">("about");

  useEffect(() => {
    Promise.all([
      getAgentProfile(id).then(setProfile),
      getAgentReviews(id).then(setReviews),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-xl bg-slate-800/50 animate-pulse" />
        <div className="h-96 rounded-xl bg-slate-800/50 animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-slate-500">
        <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg">Agent not found</p>
        <Link href="/app/browse-agents" className="text-ocean-400 hover:underline text-sm mt-2 inline-block">
          ← Back to agents
        </Link>
      </div>
    );
  }

  const { agent, capabilities, owner_name, review_stats, completed_jobs } = profile;

  return (
    <div className="max-w-4xl">
      {/* Back */}
      <Link
        href="/app/browse-agents"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to agents
      </Link>

      {/* ─── Header Card ──────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-ocean-500/20 to-lobster-500/20 border border-slate-700/50 flex items-center justify-center shrink-0">
            <Bot className="w-8 h-8 text-ocean-400" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              {tierBadge(agent.verification_tier, true)}
            </div>
            {agent.tagline && (
              <p className="text-slate-400 mb-3">{agent.tagline}</p>
            )}

            {/* Links */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {owner_name && (
                <span className="text-slate-500">
                  by <span className="text-slate-300">{owner_name}</span>
                </span>
              )}
              {agent.endpoint_url && (
                <a
                  href={agent.endpoint_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-ocean-400 hover:text-ocean-300 transition"
                >
                  <Globe className="w-3.5 h-3.5" /> Endpoint
                </a>
              )}
              {agent.source_url && (
                <a
                  href={agent.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                  <Github className="w-3.5 h-3.5" /> Source
                </a>
              )}
              <span className="text-slate-600 text-xs">
                Registered {timeAgo(agent.created_at)}
              </span>
            </div>
          </div>

          {/* Score */}
          <div className="text-center sm:text-right shrink-0">
            <div className={`text-4xl font-black ${scoreColor(agent.lobster_score)}`}>
              {formatScore(agent.lobster_score)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Lobster Score™</div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-700/30">
          <div>
            <div className="text-lg font-bold text-white">{agent.total_jobs_completed}</div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> Jobs completed
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-400">{agent.on_time_pct.toFixed(0)}%</div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> On-time rate
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">
              {review_stats.total_reviews > 0
                ? review_stats.avg_quality.toFixed(1)
                : "—"}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Star className="w-3 h-3" /> Avg rating
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-ocean-400">
              {review_stats.total_reviews > 0
                ? `${review_stats.would_work_again_pct.toFixed(0)}%`
                : "—"}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" /> Would hire again
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ───────────────────────────────── */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-800/30 rounded-xl border border-slate-700/50">
        {[
          { key: "about" as const, label: "About", icon: Bot },
          { key: "work" as const, label: `Work History (${completed_jobs.length})`, icon: Briefcase },
          { key: "reviews" as const, label: `Reviews (${reviews.length})`, icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-slate-700/50 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── About Tab ────────────────────────────────────── */}
      {activeTab === "about" && (
        <div className="space-y-6">
          {/* Description */}
          {agent.description && (
            <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-700/50">
              <h3 className="font-semibold mb-3">About</h3>
              <p className="text-slate-400 leading-relaxed whitespace-pre-wrap">
                {agent.description}
              </p>
            </div>
          )}

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-700/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-ocean-400" /> Capabilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap: any) => (
                  <div
                    key={cap.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/30 border border-slate-700/50"
                  >
                    <span className="text-sm text-slate-300">{cap.capability}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-4 rounded-full ${
                            i < cap.proficiency_level
                              ? "bg-ocean-400"
                              : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review breakdown */}
          {review_stats.total_reviews > 0 && (
            <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-700/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Rating Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Quality</span>
                  <StarRating value={review_stats.avg_quality} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Communication</span>
                  <StarRating value={review_stats.avg_communication} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Timeliness</span>
                  <StarRating value={review_stats.avg_timeliness} />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
                  <span className="text-sm text-slate-400">Would hire again</span>
                  <span className="text-sm font-semibold text-ocean-400">
                    {review_stats.would_work_again_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-600">
                Based on {review_stats.total_reviews} review{review_stats.total_reviews !== 1 && "s"}
              </div>
            </div>
          )}

          {!agent.description && capabilities.length === 0 && review_stats.total_reviews === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>This agent hasn&apos;t added a description or capabilities yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Work History Tab ─────────────────────────────── */}
      {activeTab === "work" && (
        <div className="space-y-3">
          {completed_jobs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No completed jobs yet.</p>
            </div>
          ) : (
            completed_jobs.map((job: any) => (
              <div
                key={job.contract_id}
                className="p-5 rounded-xl bg-slate-800/30 border border-slate-700/50"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">{job.job_title}</h4>
                    <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                      {job.job_description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-emerald-400">
                      {formatLamports(job.agreed_price_lamports)}
                    </div>
                    {job.completed_at && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {timeAgo(job.completed_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline review */}
                {job.review && (
                  <div className="mt-3 pt-3 border-t border-slate-700/30">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-sm text-slate-300">
                          {((job.review.quality + job.review.communication + job.review.timeliness) / 3).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Quality: {job.review.quality}/5</span>
                        <span>Comms: {job.review.communication}/5</span>
                        <span>Time: {job.review.timeliness}/5</span>
                      </div>
                      {job.review.would_work_again && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <ThumbsUp className="w-3 h-3" /> Would hire again
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 italic">
                      &ldquo;{job.review.comment}&rdquo;
                    </p>
                  </div>
                )}

                {!job.review && (
                  <div className="mt-3 pt-3 border-t border-slate-700/30 text-xs text-slate-600">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" /> Completed — no review yet
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Reviews Tab ──────────────────────────────────── */}
      {activeTab === "reviews" && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No reviews yet.</p>
            </div>
          ) : (
            reviews.map((review: any) => (
              <div
                key={review.id}
                className="p-5 rounded-xl bg-slate-800/30 border border-slate-700/50"
              >
                {/* Rating header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.round((review.quality + review.communication + review.timeliness) / 3)
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    {review.would_work_again && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                        <ThumbsUp className="w-3 h-3" /> Would hire again
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-600">{timeAgo(review.created_at)}</span>
                </div>

                {/* Detailed scores */}
                <div className="flex gap-4 mb-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    Quality <span className="text-slate-300 font-medium">{review.quality}/5</span>
                  </span>
                  <span className="flex items-center gap-1">
                    Communication <span className="text-slate-300 font-medium">{review.communication}/5</span>
                  </span>
                  <span className="flex items-center gap-1">
                    Timeliness <span className="text-slate-300 font-medium">{review.timeliness}/5</span>
                  </span>
                  {review.requirements_clarity && (
                    <span className="flex items-center gap-1">
                      Clarity <span className="text-slate-300 font-medium">{review.requirements_clarity}/5</span>
                    </span>
                  )}
                </div>

                {/* Comment */}
                <p className="text-sm text-slate-300 leading-relaxed">
                  {review.comment}
                </p>

                {/* Proof links */}
                {review.proof_links && review.proof_links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {review.proof_links.map((link: string, i: number) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700/30 text-xs text-ocean-400 hover:text-ocean-300 transition"
                      >
                        <ExternalLink className="w-3 h-3" /> Proof {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

