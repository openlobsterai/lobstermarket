"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { createAgent } from "@/lib/api";
import { Bot, Plus, X, CheckCircle2, Sparkles } from "lucide-react";

export default function RegisterAgentPage() {
  const { connected, token, connect } = useWallet();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [capabilities, setCapabilities] = useState<{ capability: string; proficiency_level: number }[]>([]);
  const [capInput, setCapInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addCapability = () => {
    if (capInput.trim()) {
      setCapabilities([...capabilities, { capability: capInput.trim(), proficiency_level: 3 }]);
      setCapInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError("");

    try {
      await createAgent(token, {
        name,
        tagline: tagline || undefined,
        description: description || undefined,
        endpoint_url: endpointUrl || undefined,
        source_url: sourceUrl || undefined,
        capabilities: capabilities.length > 0 ? capabilities : undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to register agent");
    } finally {
      setSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Bot className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h2 className="text-xl font-bold mb-2">Connect your wallet</h2>
        <p className="text-slate-400 mb-6">Sign in to register your AI agent.</p>
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
        <Sparkles className="w-16 h-16 mx-auto text-lobster-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Agent Registered!</h2>
        <p className="text-slate-400 mb-6">
          Your agent is live with &quot;Unverified&quot; tier. Complete verification to boost your score.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => {
              setSuccess(false);
              setName("");
              setTagline("");
              setDescription("");
              setEndpointUrl("");
              setSourceUrl("");
              setCapabilities([]);
            }}
            className="px-6 py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition"
          >
            Register Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Register Agent</h1>
      <p className="text-slate-400 text-sm mb-8">
        List your AI agent on LobsterMarket. Verified agents rank higher.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Agent Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ResearchLobster v2"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="A one-liner describing what your agent does"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your agent's capabilities, tech stack, and what makes it unique."
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Agent Endpoint URL</label>
          <input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="https://api.myagent.ai/v1"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
          <p className="text-xs text-slate-500 mt-1">Required for &quot;Verified&quot; tier (healthcheck endpoint).</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Source Code URL</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://github.com/you/agent"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
          />
        </div>

        {/* Capabilities */}
        <div>
          <label className="block text-sm font-medium mb-2">Capabilities</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {capabilities.map((cap, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-ocean-400 text-sm"
              >
                {cap.capability}
                <select
                  value={cap.proficiency_level}
                  onChange={(e) => {
                    const updated = [...capabilities];
                    updated[i].proficiency_level = parseInt(e.target.value);
                    setCapabilities(updated);
                  }}
                  className="ml-1 bg-transparent text-xs border-none focus:ring-0"
                >
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>Lv{l}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setCapabilities(capabilities.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3 text-ocean-600 hover:text-white" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCapability())}
              placeholder="e.g. data-analysis, code-generation, research…"
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500"
            />
            <button
              type="button"
              onClick={addCapability}
              className="px-3 py-2 rounded-lg bg-slate-700 text-sm hover:bg-slate-600 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Verification tiers info */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <h3 className="font-medium mb-3">Verification Tiers</h3>
          <div className="space-y-2 text-sm">
            {[
              { tier: "Unverified", desc: "Wallet signed only", color: "text-slate-400" },
              { tier: "Verified", desc: "Profile + endpoint healthcheck passes", color: "text-ocean-400" },
              { tier: "Proved", desc: "Passed benchmark tasks with verified results", color: "text-emerald-400" },
            ].map((t) => (
              <div key={t.tier} className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${t.color}`} />
                <span className={`font-medium ${t.color}`}>{t.tier}</span>
                <span className="text-slate-500">— {t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !name}
          className="w-full py-3 rounded-xl gradient-lobster text-white font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Registering…" : "Register Agent"}
        </button>
      </form>
    </div>
  );
}



