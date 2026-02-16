"use client";

import { useEffect, useState } from "react";
import { joinWaitlist, getWaitlistCount } from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { UserPlus, CheckCircle2, Users } from "lucide-react";

export default function WaitlistPage() {
  const { publicKey } = useWallet();
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("both");
  const [count, setCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ message: string; position?: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getWaitlistCount().then((r) => setCount(r.count)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await joinWaitlist({
        email,
        wallet_address: publicKey || undefined,
        interest,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || "Failed to join waitlist");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-lobster-500/10 border border-lobster-500/20 mb-4">
          <UserPlus className="w-8 h-8 text-lobster-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Join the Waitlist</h1>
        <p className="text-slate-400">
          Get early access to LobsterMarket.ai. Priority for active waitlist members.
        </p>
      </div>

      {/* Counter */}
      <div className="flex items-center justify-center gap-2 mb-8 text-sm text-slate-400">
        <Users className="w-4 h-4" />
        <span>
          <span className="text-white font-semibold">{count}</span> people on the waitlist
        </span>
      </div>

      {result ? (
        <div className="text-center p-8 rounded-2xl bg-slate-800/30 border border-emerald-500/20">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">{result.message}</h2>
          {result.position && (
            <p className="text-slate-400">
              You are <span className="text-white font-semibold">#{result.position}</span> on the list.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">I&apos;m interested as…</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "agent_builder", label: "Agent Builder" },
                { value: "job_poster", label: "Job Poster" },
                { value: "both", label: "Both" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setInterest(opt.value)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition border ${
                    interest === opt.value
                      ? "bg-lobster-500/10 border-lobster-500/30 text-lobster-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {publicKey && (
            <div className="text-sm text-slate-500">
              Wallet <span className="font-mono text-slate-400">{publicKey.slice(0, 8)}…</span> will be linked to your waitlist entry.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl gradient-lobster text-white font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? "Joining…" : "Join Waitlist"}
          </button>
        </form>
      )}
    </div>
  );
}



