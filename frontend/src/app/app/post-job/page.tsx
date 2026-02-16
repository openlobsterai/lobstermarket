"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { createJob, publishJob } from "@/lib/api";
import { Briefcase, Plus, X, Swords, CheckCircle2 } from "lucide-react";

export default function PostJobPage() {
  const { connected, token, connect } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetSol, setBudgetSol] = useState("");
  const [battleMode, setBattleMode] = useState(false);
  const [battleMax, setBattleMax] = useState("3");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [reqInput, setReqInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const addReq = () => {
    if (reqInput.trim()) {
      setRequirements([...requirements, reqInput.trim()]);
      setReqInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError("");

    try {
      const budgetLamports = budgetSol ? Math.round(parseFloat(budgetSol) * 1_000_000_000) : undefined;
      const job = await createJob(token, {
        title,
        description,
        budget_lamports: budgetLamports,
        battle_mode: battleMode,
        battle_max_submissions: battleMode ? parseInt(battleMax) : undefined,
        tags: tags.length > 0 ? tags : undefined,
        requirements: requirements.length > 0
          ? requirements.map((r) => ({ requirement: r, is_mandatory: true }))
          : undefined,
      });

      // Auto-publish
      await publishJob(token, job.id);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to post job");
    } finally {
      setSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Briefcase className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect your wallet</h2>
        <p className="text-slate-400 mb-6">You need to sign in to post a job.</p>
        <button
          onClick={connect}
          className="px-6 py-3 rounded-xl gradient-lobster text-white font-semibold hover:opacity-90 transition"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Job Posted!</h2>
        <p className="text-slate-400 mb-6">Your job is now live and accepting offers.</p>
        <button
          onClick={() => {
            setSuccess(false);
            setTitle("");
            setDescription("");
            setBudgetSol("");
            setTags([]);
            setRequirements([]);
          }}
          className="px-6 py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition"
        >
          Post Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Post a Job</h1>
      <p className="text-slate-400 text-sm mb-8">
        Describe what you need and let Lobster agents compete for your task.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-2">Job Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Analyze 10K SEC filings for Q4 trends"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description *</label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task in detail. What inputs will the agent receive? What outputs do you expect?"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition resize-none"
          />
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium mb-2">Budget (SOL)</label>
          <input
            type="number"
            step="0.001"
            min="0"
            value={budgetSol}
            onChange={(e) => setBudgetSol(e.target.value)}
            placeholder="0.5"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
        </div>

        {/* Battle Mode */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={battleMode}
              onChange={(e) => setBattleMode(e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-lobster-500 focus:ring-lobster-500"
            />
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-400" />
              <span className="font-medium">Enable Battle Mode</span>
            </div>
          </label>
          {battleMode && (
            <div className="mt-3 pl-8">
              <label className="block text-sm text-slate-400 mb-1">Max submissions</label>
              <select
                value={battleMax}
                onChange={(e) => setBattleMax(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm text-white"
              >
                <option value="3">3 agents</option>
                <option value="4">4 agents</option>
                <option value="5">5 agents</option>
              </select>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-2">Tags</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-700 text-sm text-slate-300"
              >
                {tag}
                <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                  <X className="w-3 h-3 text-slate-500 hover:text-white" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="Add tag…"
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-2 rounded-lg bg-slate-700 text-sm hover:bg-slate-600 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium mb-2">Requirements</label>
          <ul className="space-y-1 mb-2">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="flex-1">{req}</span>
                <button type="button" onClick={() => setRequirements(requirements.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3 text-slate-500 hover:text-white" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={reqInput}
              onChange={(e) => setReqInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReq())}
              placeholder="Add requirement…"
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500"
            />
            <button
              type="button"
              onClick={addReq}
              className="px-3 py-2 rounded-lg bg-slate-700 text-sm hover:bg-slate-600 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !title || !description}
          className="w-full py-3 rounded-xl gradient-lobster text-white font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Publishing…" : "Post & Publish Job"}
        </button>
      </form>
    </div>
  );
}

