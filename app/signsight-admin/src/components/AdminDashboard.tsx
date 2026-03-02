"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FeedbackRow,
  listFeedback,
  resolveFeedback,
  getToken,
  AuditRow,
  listAudit,
  createAuditMultipart,
  AUDIT_CATEGORIES,
  absoluteUrl,
} from "@/lib/api";

const FEEDBACK_CATEGORIES = ["general", "ui", "bug", "feature", "performance"] as const;

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger";
}) {
  const map = {
    neutral: "bg-white/6 border-white/10 text-white/80",
    ok: "bg-emerald-400/10 border-emerald-300/20 text-emerald-200",
    warn: "bg-amber-400/10 border-amber-300/20 text-amber-200",
    danger: "bg-rose-400/10 border-rose-300/20 text-rose-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-wide",
        map[tone]
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4">
        <div>
          <div className="text-sm font-black">{title}</div>
          {subtitle && <div className="mt-1 text-xs text-white/55">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-40 rounded bg-white/10" />
          <div className="h-3 w-56 rounded bg-white/8" />
        </div>
        <div className="h-8 w-24 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"feedback" | "audit">("feedback");

  // -------------------------
  // Feedback state
  // -------------------------
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
      const res = await listFeedback({
        q: q.trim() || undefined,
        status: status || undefined,
        category: category || undefined,
        limit: 300,
      });
      setRows(res);
    } catch (e: any) {
      setErr("Failed to load feedback (token expired or server offline).");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Audit state
  // -------------------------
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditErr, setAuditErr] = useState("");

  const [aq, setAq] = useState("");
  const [aCategory, setACategory] = useState("");

  const fetchAudit = async () => {
    try {
      setAuditErr("");
      setAuditLoading(true);
      const res = await listAudit({
        q: aq.trim() || undefined,
        category: aCategory || undefined,
        limit: 300,
      });
      setAuditRows(res);
    } catch (e: any) {
      setAuditErr("Failed to load audit trail (token expired or server offline).");
    } finally {
      setAuditLoading(false);
    }
  };

  // Create audit form
  const [aTitle, setATitle] = useState("");
  const [aDetails, setADetails] = useState("");
  const [aCreateCategory, setACreateCategory] = useState("other");
  const [aFiles, setAFiles] = useState<File[]>([]);
  const [aCreating, setACreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onPickAuditFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const next = [...aFiles, ...arr].slice(0, 3);
    setAFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAuditFile = (name: string) => {
    setAFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const createAudit = async () => {
    const title = aTitle.trim();
    if (title.length < 2) {
      alert("Title too short.");
      return;
    }

    try {
      setACreating(true);

      const fd = new FormData();
      fd.append("title", title);
      fd.append("category", aCreateCategory);
      if (aDetails.trim()) fd.append("details", aDetails.trim());
      aFiles.forEach((f) => fd.append("images", f));

      await createAuditMultipart(fd);

      setATitle("");
      setADetails("");
      setACreateCategory("other");
      setAFiles([]);

      await fetchAudit();
    } catch (e: any) {
      alert("Create audit failed. Check server / token.");
    } finally {
      setACreating(false);
    }
  };

  // -------------------------
  // Counts
  // -------------------------
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

  useEffect(() => {
    fetchRows();
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // image viewer modal
  const [imgModal, setImgModal] = useState<{ open: boolean; src: string } | null>(null);

  const ImgModal = () => {
    if (!imgModal?.open) return null;
    return (
      <div
        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        onClick={() => setImgModal(null)}
      >
        <div
          className="max-w-4xl w-full rounded-3xl border border-white/10 bg-black/60 p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgModal.src} alt="attachment" className="w-full h-auto rounded-2xl" />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setImgModal(null)}
              className="rounded-2xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 font-extrabold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const inputBase =
    "rounded-2xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300/45 focus:ring-2 focus:ring-emerald-400/10 transition";
  const btnBase =
    "rounded-2xl px-4 py-2 border font-extrabold transition active:scale-[0.99]";
  const btnGhost = "bg-white/5 border-white/10 hover:bg-white/10";
  const btnPrimary = "bg-emerald-300/18 border-emerald-300/25 hover:bg-emerald-300/22";

  return (
    <div className="min-h-screen">
      <ImgModal />

      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050707]" />
        <div className="absolute -top-24 left-1/2 h-72 w-[60rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-72 w-[50rem] -translate-x-1/2 rounded-full bg-emerald-400/8 blur-3xl" />
      </div>

      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-400/15 border border-emerald-300/25 flex items-center justify-center shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
              <span className="text-emerald-200 font-black">SS</span>
            </div>

            <div>
              <div className="text-lg font-black leading-tight">
                {tab === "feedback" ? "Feedback Inbox" : "Audit Trail"}
              </div>
              <div className="text-white/55 text-xs mt-0.5">
                {tab === "feedback"
                  ? `Open: ${openCount} • Total: ${rows.length}`
                  : `Total: ${auditRows.length}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tab === "feedback" && (
              <button onClick={exportCsv} className={clsx(btnBase, btnGhost)}>
                Export CSV
              </button>
            )}

            <button
              onClick={() => (tab === "feedback" ? fetchRows() : fetchAudit())}
              className={clsx(btnBase, btnPrimary)}
            >
              Refresh
            </button>

            <button onClick={onLogout} className={clsx(btnBase, btnGhost)}>
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-6xl px-6 pb-4">
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setTab("feedback")}
              className={clsx(
                "rounded-xl px-4 py-2 text-sm font-extrabold transition",
                tab === "feedback"
                  ? "bg-emerald-300/20 border border-emerald-300/25"
                  : "text-white/70 hover:text-white"
              )}
            >
              Feedback
            </button>
            <button
              onClick={() => setTab("audit")}
              className={clsx(
                "rounded-xl px-4 py-2 text-sm font-extrabold transition",
                tab === "audit"
                  ? "bg-emerald-300/20 border border-emerald-300/25"
                  : "text-white/70 hover:text-white"
              )}
            >
              Audit Trail
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl p-6 space-y-5">
        {/* FEEDBACK TAB */}
        {tab === "feedback" && (
          <>
            {/* Filters */}
            <SectionCard
              title="Filters"
              subtitle="Search and narrow down feedback quickly."
              right={
                <div className="hidden md:flex items-center gap-2 text-xs text-white/45">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-300/80" />
                    Live
                  </span>
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-4">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search text…"
                  className={inputBase}
                />

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className={inputBase}
                >
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="">All</option>
                </select>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputBase}
                >
                  <option value="">All categories</option>
                  {FEEDBACK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button onClick={fetchRows} className={clsx(btnBase, btnPrimary, "py-3")}>
                  Apply
                </button>
              </div>

              {!!err && (
                <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm">
                  {err}
                </div>
              )}
            </SectionCard>

            {/* List */}
            <SectionCard
              title="Results"
              subtitle={
                status === "open"
                  ? "Showing open feedback items."
                  : status === "resolved"
                  ? "Showing resolved feedback items."
                  : "Showing all feedback items."
              }
              right={
                <div className="flex items-center gap-2">
                  <Pill tone="ok">{openCount} open</Pill>
                  <Pill>{rows.length} total</Pill>
                </div>
              }
            >
              {loading ? (
                <div className="space-y-3">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                  <div className="text-base font-black">No feedback found</div>
                  <div className="text-sm text-white/55 mt-1">
                    Try changing filters or refresh.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => {
                    const cat = (r.category || "general").toLowerCase();
                    const catTone =
                      cat === "bug"
                        ? "danger"
                        : cat === "performance"
                        ? "warn"
                        : cat === "ui" || cat === "feature"
                        ? "ok"
                        : "neutral";

                    return (
                      <div
                        key={r.id}
                        className="rounded-3xl border border-white/10 bg-black/20 p-4 hover:bg-black/25 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Pill tone={catTone as any}>{cat}</Pill>
                              <span className="text-xs text-white/45">
                                {new Date(r.created_at).toLocaleString()}
                              </span>
                              <span className="text-xs text-white/25">•</span>
                              <span className="text-xs text-white/45">
                                {r.platform ?? "-"} • {r.app_version ?? "-"} • {r.device ?? "-"}
                              </span>
                            </div>

                            <div className="mt-2 text-sm font-black text-white/90 break-words">
                              {r.message}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <Pill>{r.rating ?? "-"}</Pill>
                              {r.resolved ? (
                                <Pill tone="ok">resolved</Pill>
                              ) : (
                                <Pill tone="warn">open</Pill>
                              )}
                            </div>

                            {/* Images */}
                            {(r.image_urls?.length ?? 0) > 0 && (
                              <div className="mt-3 flex gap-2 flex-wrap">
                                {r.image_urls!.map((u) => {
                                  const src = absoluteUrl(u);
                                  return (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={u}
                                      src={src}
                                      alt="attachment"
                                      className="h-16 w-16 rounded-2xl border border-white/10 object-cover cursor-pointer hover:opacity-90 hover:scale-[1.02] transition"
                                      onClick={() => setImgModal({ open: true, src })}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0">
                            {r.resolved ? (
                              <button
                                disabled
                                className={clsx(btnBase, "bg-white/5 border-white/10 text-white/45 cursor-not-allowed")}
                              >
                                Resolved
                              </button>
                            ) : (
                              <button
                                onClick={() => markResolved(r.id)}
                                className={clsx(btnBase, btnPrimary)}
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {/* AUDIT TAB */}
        {tab === "audit" && (
          <>
            <SectionCard
              title="Create audit entry"
              subtitle="Use this when you fixed/changed something (UI/bug/performance/etc.). Optional images allowed."
            >
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={aTitle}
                  onChange={(e) => setATitle(e.target.value)}
                  placeholder="Title (e.g., Fixed camera lag)"
                  className={clsx(inputBase, "md:col-span-2")}
                />

                <select
                  value={aCreateCategory}
                  onChange={(e) => setACreateCategory(e.target.value)}
                  className={inputBase}
                >
                  {AUDIT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <textarea
                  value={aDetails}
                  onChange={(e) => setADetails(e.target.value)}
                  placeholder="Details (optional)…"
                  className={clsx(inputBase, "md:col-span-3 min-h-[110px]")}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => onPickAuditFiles(e.target.files)}
                    className="hidden"
                    id="auditFiles"
                  />
                  <label
                    htmlFor="auditFiles"
                    className={clsx(btnBase, btnGhost, "cursor-pointer")}
                  >
                    Attach images (max 3)
                  </label>

                  <div className="text-xs text-white/50">{aFiles.length}/3 selected</div>
                </div>

                {aFiles.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {aFiles.map((f) => (
                      <button
                        key={f.name}
                        onClick={() => removeAuditFile(f.name)}
                        className="rounded-2xl px-3 py-2 text-xs font-extrabold bg-emerald-300/12 border border-emerald-300/20 hover:bg-emerald-300/18 transition"
                        title="Remove"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1" />

                <button
                  onClick={createAudit}
                  disabled={aCreating}
                  className={clsx(
                    btnBase,
                    aCreating
                      ? "bg-white/5 border-white/10 text-white/50 cursor-not-allowed"
                      : btnPrimary
                  )}
                >
                  {aCreating ? "Creating…" : "Create"}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Filters" subtitle="Search audit entries by title/details and category.">
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={aq}
                  onChange={(e) => setAq(e.target.value)}
                  placeholder="Search title/details…"
                  className={inputBase}
                />

                <select
                  value={aCategory}
                  onChange={(e) => setACategory(e.target.value)}
                  className={inputBase}
                >
                  <option value="">All categories</option>
                  {AUDIT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <button onClick={fetchAudit} className={clsx(btnBase, btnPrimary, "py-3")}>
                  Apply
                </button>
              </div>

              {!!auditErr && (
                <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-rose-200 text-sm">
                  {auditErr}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Audit entries" subtitle="Newest first.">
              {auditLoading ? (
                <div className="space-y-3">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : auditRows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                  <div className="text-base font-black">No audit entries yet</div>
                  <div className="text-sm text-white/55 mt-1">Create one above to start logging changes.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditRows.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-4 hover:bg-black/25 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Pill tone="ok">{(a.category || "other").toString()}</Pill>
                            <span className="text-xs text-white/45">
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="mt-2 text-sm font-black text-white/90">{a.title}</div>

                          {!!a.details && (
                            <div className="mt-1 text-sm text-white/75 whitespace-pre-wrap break-words">
                              {a.details}
                            </div>
                          )}

                          {(a.image_urls?.length ?? 0) > 0 && (
                            <div className="mt-3 flex gap-2 flex-wrap">
                              {a.image_urls!.map((u) => {
                                const src = absoluteUrl(u);
                                return (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={u}
                                    src={src}
                                    alt="attachment"
                                    className="h-16 w-16 rounded-2xl border border-white/10 object-cover cursor-pointer hover:opacity-90 hover:scale-[1.02] transition"
                                    onClick={() => setImgModal({ open: true, src })}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}

        <div className="pb-10 text-center text-xs text-white/35">
          SignSight Admin • Powered by FastAPI + MongoDB
        </div>
      </div>
    </div>
  );
}