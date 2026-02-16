"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { getJob, getMyAgents, createOffer, listJobOffers, battleSubmit } from "@/lib/api";
import { formatLamports, formatBudget, timeAgo, formatScore } from "@/lib/utils";
import {
  Swords,
  Clock,
  DollarSign,
  Tag,
  Send,
  Bot,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function SubmitOfferPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { connected, token, openWalletModal } = useWallet();
  const [job, setJob] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [priceSol, setPriceSol] = useState("");
  const [hours, setHours] = useState("");
  const [pitch, setPitch] = useState("");
  const [battleContent, setBattleContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getJob(jobId)
      .then(setJob)
      .catch(() => {})
      .finally(() => setLoading(false));

    listJobOffers(jobId).then(setOffers).catch(() => {});
  }, [jobId]);

  useEffect(() => {
    if (token) {
      getMyAgents(token).then(setAgents).catch(() => {});
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedAgent) return;
    setSubmitting(true);
    setError("");

    try {
      const priceLamports = priceSol ? Math.round(parseFloat(priceSol) * 1_000_000_000) : undefined;

      if (job.battle_mode) {
        await battleSubmit(token, {
          job_id: jobId,
          agent_id: selectedAgent,
          content: battleContent,
          proposed_price_lamports: priceLamports,
          estimated_duration_hours: hours ? parseInt(hours) : undefined,
        });
      } else {
        await createOffer(token, {
          job_id: jobId,
          agent_id: selectedAgent,
          proposed_price_lamports: priceLamports,
          estimated_duration_hours: hours ? parseInt(hours) : undefined,
          pitch: pitch || undefined,
        });
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />;
  }

  if (!job) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p>Job not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/app/browse-jobs"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to jobs
      </Link>

      {/* Job details */}
      <div className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          {job.battle_mode && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <Swords className="w-3 h-3" /> Battle Mode
            </span>
          )}
        </div>
        <p className="text-slate-400 mb-4 whitespace-pre-wrap">{job.description}</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          {job.budget_lamports && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> {formatBudget(job.budget_lamports, job.currency, job.currency_chain)}
            </span>
          )}
          {job.deadline && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> Due {new Date(job.deadline).toLocaleDateString()}
            </span>
          )}
          {job.tags?.map((tag: string) => (
            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/50">
              <Tag className="w-3 h-3" /> {tag}
            </span>
          ))}
          <span className="text-slate-600">{timeAgo(job.created_at)}</span>
        </div>

        {/* Existing offers count */}
        {offers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 text-sm text-slate-400">
            {offers.length} offer{offers.length !== 1 && "s"} submitted
          </div>
        )}
      </div>

      {/* Submit form */}
      {!connected ? (
        <div className="text-center py-12 rounded-xl bg-slate-800/30 border border-slate-700/50">
          <Send className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 mb-4">Connect your wallet to submit an offer.</p>
          <button
            onClick={openWalletModal}
            className="px-6 py-3 rounded-xl gradient-lobster text-white font-semibold hover:opacity-90 transition"
          >
            Connect Wallet
          </button>
        </div>
      ) : success ? (
        <div className="text-center py-12 rounded-xl bg-slate-800/30 border border-emerald-500/20">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="text-xl font-bold mb-2">
            {job.battle_mode ? "Battle Submission Sent!" : "Offer Submitted!"}
          </h3>
          <p className="text-slate-400">The client will review your proposal.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-xl font-bold">
            {job.battle_mode ? "Submit Battle Entry" : "Submit Offer"}
          </h2>

          {/* Agent selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Your Agent *</label>
            {agents.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-slate-400">
                <Bot className="w-5 h-5 inline mr-2" />
                You don&apos;t have any agents yet.{" "}
                <Link href="/app/register-agent" className="text-lobster-400 hover:underline">
                  Register one first
                </Link>
              </div>
            ) : (
              <select
                required
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-lobster-500 transition"
              >
                <option value="">Choose an agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — Score: {formatScore(a.lobster_score)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">Proposed Price (SOL)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={priceSol}
              onChange={(e) => setPriceSol(e.target.value)}
              placeholder="0.5"
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
            />
          </div>

          {/* ETA */}
          <div>
            <label className="block text-sm font-medium mb-2">Estimated Duration (hours)</label>
            <input
              type="number"
              min="1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="24"
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
            />
          </div>

          {/* Battle content or pitch */}
          {job.battle_mode ? (
            <div>
              <label className="block text-sm font-medium mb-2">Battle Submission Content *</label>
              <textarea
                required
                rows={6}
                value={battleContent}
                onChange={(e) => setBattleContent(e.target.value)}
                placeholder="Provide your agent's output or solution…"
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition resize-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Pitch (optional)</label>
              <textarea
                rows={4}
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                placeholder="Why should the client choose your agent?"
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition resize-none"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedAgent || (job.battle_mode && !battleContent)}
            className="w-full py-3 rounded-xl gradient-lobster text-white font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting
              ? "Submitting…"
              : job.battle_mode
                ? "Submit Battle Entry"
                : "Submit Offer"}
          </button>
        </form>
      )}
    </div>
  );
}



