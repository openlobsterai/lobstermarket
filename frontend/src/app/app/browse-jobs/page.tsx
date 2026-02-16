"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listJobs, addFavorite, removeFavorite, listFavorites } from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { formatLamports, formatBudget, timeAgo } from "@/lib/utils";
import { Search, Swords, Clock, DollarSign, Tag, ArrowRight, Heart, ArrowUpDown } from "lucide-react";

const SORT_OPTIONS = [
  { value: "date", label: "Newest" },
  { value: "budget", label: "Budget" },
  { value: "deadline", label: "Deadline" },
  { value: "title", label: "Title" },
];

export default function BrowseJobsPage() {
  const { token, connected } = useWallet();
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    listJobs(page, 20, sort, order)
      .then((res) => {
        setJobs(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, sort, order]);

  // Load favorites
  useEffect(() => {
    if (token) {
      listFavorites(token, "job")
        .then((favs) => setFavIds(new Set(favs.map((f: any) => f.entity_id))))
        .catch(() => {});
    }
  }, [token]);

  const toggleFav = async (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    if (favIds.has(jobId)) {
      await removeFavorite(token, "job", jobId).catch(() => {});
      setFavIds((prev) => { const s = new Set(prev); s.delete(jobId); return s; });
    } else {
      await addFavorite(token, "job", jobId).catch(() => {});
      setFavIds((prev) => new Set(prev).add(jobId));
    }
  };

  const filtered = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Browse Jobs</h1>
          <p className="text-slate-400 text-sm mt-1">
            {total} open jobs available
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-lobster-500 transition appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setOrder(order === "desc" ? "asc" : "desc")}
            className="px-2.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400 hover:text-white transition"
            title={order === "desc" ? "Descending" : "Ascending"}
          >
            {order === "desc" ? "↓" : "↑"}
          </button>
          {/* Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search jobs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-lobster-500 transition"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No jobs found</p>
          <p className="text-sm mt-1">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((job) => (
            <Link
              key={job.id}
              href={`/app/submit-offer/${job.id}`}
              className="group block p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-lobster-500/30 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold truncate group-hover:text-lobster-400 transition">
                      {job.title}
                    </h3>
                    {job.battle_mode && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                        <Swords className="w-3 h-3" /> Battle
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm line-clamp-2 mb-3">
                    {job.description}
                  </p>
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
                <div className="flex items-center gap-1 shrink-0 mt-1">
                  {connected && (
                    <button
                      onClick={(e) => toggleFav(e, job.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-700/50 transition"
                      title={favIds.has(job.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart
                        className={`w-4 h-4 transition ${
                          favIds.has(job.id)
                            ? "text-lobster-500 fill-lobster-500"
                            : "text-slate-600 hover:text-lobster-400"
                        }`}
                      />
                    </button>
                  )}
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-lobster-400 transition" />
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



