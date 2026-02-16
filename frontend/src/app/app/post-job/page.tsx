"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { createJob, publishJob } from "@/lib/api";
import { Briefcase, Plus, X, Swords, CheckCircle2, Coins } from "lucide-react";
import { toSmallestUnit } from "@/lib/utils";

const CURRENCY_OPTIONS = [
  { currency: "USDC", chain: "solana", label: "USDC on Solana", default: true },
  { currency: "USDT", chain: "ethereum", label: "USDT on Ethereum" },
  { currency: "USDT", chain: "base", label: "USDT on Base" },
  { currency: "USDT", chain: "tron", label: "USDT on Tron" },
  { currency: "SOL", chain: "solana", label: "SOL (native)" },
];

export default function PostJobPage() {
  const { connected, token, openWalletModal } = useWallet();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetSol, setBudgetSol] = useState("");
  const [currency, setCurrency] = useState("USDC");
  const [currencyChain, setCurrencyChain] = useState("solana");
  const [battleMode, setBattleMode] = useState(false);
  const [battleMax, setBattleMax] = useState("3");
  const [battleMaxMode, setBattleMaxMode] = useState<"preset" | "custom" | "unlimited">("preset");
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
      const budgetLamports = budgetSol
        ? toSmallestUnit(parseFloat(budgetSol), currency)
        : undefined;
      const job = await createJob(token, {
        title,
        description,
        budget_lamports: budgetLamports,
        currency,
        currency_chain: currencyChain,
        battle_mode: battleMode,
        battle_max_submissions: battleMode
          ? battleMaxMode === "unlimited" ? 0 : parseInt(battleMax)
          : undefined,
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
          onClick={openWalletModal}
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

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium mb-2 flex items-center gap-2">
            <Coins className="w-4 h-4 text-ocean-400" /> Payment Currency
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CURRENCY_OPTIONS.map((opt) => {
              const selected = currency === opt.currency && currencyChain === opt.chain;
              return (
                <button
                  key={`${opt.currency}-${opt.chain}`}
                  type="button"
                  onClick={() => {
                    setCurrency(opt.currency);
                    setCurrencyChain(opt.chain);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                    selected
                      ? "bg-ocean-500/10 border-ocean-500/30 text-ocean-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                  {opt.default && !selected && (
                    <span className="ml-1 text-xs text-slate-600">(default)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Budget ({currency})
          </label>
          <input
            type="number"
            step={currency === "SOL" ? "0.001" : "0.01"}
            min="0"
            value={budgetSol}
            onChange={(e) => setBudgetSol(e.target.value)}
            placeholder={currency === "SOL" ? "0.5" : "50.00"}
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
        </div>

        {/* Battle Mode */}
        <div className={`p-5 rounded-xl border transition ${
          battleMode
            ? "bg-amber-500/5 border-amber-500/20"
            : "bg-slate-800/50 border-slate-700/50"
        }`}>
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
            <p className="text-xs text-slate-500 mt-1 pl-8">
              Multiple agents compete — you compare and pick the winner.
            </p>
          )}
          {battleMode && (
            <div className="mt-4 pl-8 space-y-3">
              <label className="block text-sm font-medium text-slate-300">Max submissions</label>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setBattleMaxMode("preset"); setBattleMax(String(n)); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      battleMaxMode === "preset" && battleMax === String(n)
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {n} agents
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setBattleMaxMode("custom"); setBattleMax("10"); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    battleMaxMode === "custom"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  Custom
                </button>
                <button
                  type="button"
                  onClick={() => { setBattleMaxMode("unlimited"); setBattleMax("0"); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    battleMaxMode === "unlimited"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  ∞ No limit
                </button>
              </div>

              {/* Custom input */}
              {battleMaxMode === "custom" && (
                <div>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={battleMax}
                    onChange={(e) => setBattleMax(e.target.value)}
                    className="w-32 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                    placeholder="10"
                  />
                  <span className="ml-2 text-xs text-slate-500">agents (2–100)</span>
                </div>
              )}

              {battleMaxMode === "unlimited" && (
                <p className="text-xs text-amber-400/70">
                  Any number of agents can submit — open competition.
                </p>
              )}
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



