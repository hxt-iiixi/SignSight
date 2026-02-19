"use client";

import { useEffect, useMemo, useState } from "react";
import { FeedbackRow, listFeedback, resolveFeedback, getToken } from "@/lib/api";

const CATEGORIES = ["general", "ui", "bug", "feature", "performance"] as const;

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "open" | "resolved">("open");
  const [category, setCategory] = useState("");

  const fetchRows = async () => {
    try {
      setErr("");
      setLoading(true);
      const res = await listFeedback({ q: q.trim() || undefined, status: status || undefined, category: category || undefined, limit: 300 });
      setRows(res);
    } catch (e: any) {
      setErr("Failed to load feedback (token expired or server offline).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCount = useMemo(() => rows.filter((r) => !r.resolved).length, [rows]);

  const markResolved = async (id: string) => {
    try {
      await resolveFeedback(id);
      await fetchRows();
    } catch {
      alert("Resolve failed. Check server.");
    }
  };

  const exportCsv = async () => {
    const token = getToken();
    if (!token) return;

    const API = process.env.NEXT_PUBLIC_API_BASE!;
    const res = await fetch(`${API}/admin/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert("Export failed.");
      return;
    }
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `signsight_feedback_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6">
      {/* Topbar */}
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-400/15 border border-emerald-300/25 flex items-center justify-center">
            <span className="text-emerald-300 font-black">SS</span>
          </div>
          <div>
            <div className="text-xl font-black">Feedback</div>
            <div className="text-white/55 text-sm">Open: {openCount} • Total: {rows.length}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="rounded-xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/8 font-extrabold">
            Export CSV
          </button>
          <button onClick={fetchRows} className="rounded-xl px-4 py-2 bg-emerald-300/20 border border-emerald-300/30 hover:bg-emerald-300/25 font-extrabold">
            Refresh
          </button>
          <button onClick={onLogout} className="rounded-xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/8 font-extrabold">
            Logout
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto max-w-6xl mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search text…"
            className="rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300/50"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300/50"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="">All</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300/50"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={fetchRows}
            className="rounded-xl px-4 py-3 bg-emerald-300/20 border border-emerald-300/30 hover:bg-emerald-300/25 font-extrabold"
          >
            Apply
          </button>
        </div>

        {!!err && <div className="mt-3 text-red-300 text-sm">{err}</div>}
      </div>

      {/* Table */}
      <div className="mx-auto max-w-6xl mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-12 text-xs text-white/55 px-4 py-3 border-b border-white/10">
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-1">Rate</div>
          <div className="col-span-5">Message</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        {loading ? (
          <div className="p-6 text-white/70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-white/60">No feedback found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-12 px-4 py-4 text-sm">
                <div className="col-span-2 text-white/70">
                  {new Date(r.created_at).toLocaleString()}
                </div>
                <div className="col-span-2">
                  <span className="inline-flex rounded-full bg-white/5 border border-white/10 px-2 py-1 text-xs font-extrabold">
                    {r.category || "general"}
                  </span>
                </div>
                <div className="col-span-1 text-white/70">{r.rating ?? "-"}</div>
                <div className="col-span-5 text-white/90">
                  <div className="font-bold text-white/90 line-clamp-2">{r.message}</div>
                  <div className="text-xs text-white/45 mt-1">
                    {r.platform ?? "-"} • {r.app_version ?? "-"} • {r.device ?? "-"}
                  </div>
                </div>
                <div className="col-span-2 flex justify-end items-start gap-2">
                  {r.resolved ? (
                    <span className="rounded-xl px-3 py-2 text-xs font-extrabold bg-white/5 border border-white/10 text-white/60">
                      Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => markResolved(r.id)}
                      className="rounded-xl px-3 py-2 text-xs font-extrabold bg-emerald-300/20 border border-emerald-300/30 hover:bg-emerald-300/25"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl mt-5 text-center text-xs text-white/35">
        SignSight Admin • Powered by FastAPI + MongoDB
      </div>
    </div>
  );
}
