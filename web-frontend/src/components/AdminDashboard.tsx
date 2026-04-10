"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "../lib/api";

const FEEDBACK_CATEGORIES = ["general", "ui", "bug", "feature", "performance"] as const;
const RESOLVE_UNDO_MS = 5000;

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
    neutral: "bg-white border-[#E5E7EB] text-[#374151]",
    ok: "bg-[#FCE7F3] border-[#F9A8D4]/40 text-[#BE185D]",
    warn: "bg-[#FEF3C7] border-[#FDE68A]/40 text-[#92400E]",
    danger: "bg-[#FEE2E2] border-[#FCA5A5]/40 text-[#B91C1C]",
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
    <div className="rounded-3xl border border-[#E5E7EB] bg-white/85 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4 border-b border-[#F3F4F6] p-4">
        <div>
          <div className="text-sm font-black text-[#1F2937]">{title}</div>
          {subtitle && <div className="mt-1 text-xs text-[#6B7280]">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFDF8] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-40 rounded bg-[#F3F4F6]" />
          <div className="h-3 w-56 rounded bg-[#E5E7EB]" />
        </div>
        <div className="h-8 w-24 rounded-xl bg-[#F3F4F6]" />
      </div>
    </div>
  );
}

function InlineSpinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#F9A8D4]/40 border-t-[#BE185D]" />
  );
}

function ExpandableText({
  text,
  previewChars = 180,
  className = "",
}: {
  text: string;
  previewChars?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldClamp = text.length > previewChars;
  const shown = !shouldClamp || expanded ? text : `${text.slice(0, previewChars).trim()}…`;

  return (
    <div className={className}>
      <span>{shown}</span>
      {shouldClamp && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-extrabold text-[#BE185D] transition hover:text-[#831843]"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </>
      )}
    </div>
  );
}

type ToastTone = "ok" | "warn" | "danger";
type ToastItem = {
  id: string;
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

function Toasts({
  items,
  onClose,
}: {
  items: ToastItem[];
  onClose: (id: string) => void;
}) {
  if (items.length === 0) return null;

  const toneMap: Record<ToastTone, string> = {
    ok: "border-[#F9A8D4]/40 bg-white text-[#1F2937]",
    warn: "border-[#FDE68A]/40 bg-white text-[#1F2937]",
    danger: "border-[#FCA5A5]/40 bg-white text-[#1F2937]",
  };

  return (
    <div className="fixed right-4 top-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-3">
      {items.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl",
            toneMap[t.tone || "ok"]
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 text-sm font-semibold text-[#374151]">{t.message}</div>
            <button
              type="button"
              onClick={() => onClose(t.id)}
              className="text-xs font-black text-[#9CA3AF] transition hover:text-[#6B7280]"
            >
              ✕
            </button>
          </div>

          {(t.actionLabel || true) && (
            <div className="mt-3 flex items-center gap-2">
              {t.actionLabel && t.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction?.();
                    onClose(t.id);
                  }}
                  className="rounded-xl border border-[#F9A8D4]/40 bg-[#FCE7F3] px-3 py-1.5 text-xs font-black text-[#BE185D] transition hover:bg-[#F9A8D4]/20"
                >
                  {t.actionLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => onClose(t.id)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-black text-[#6B7280] transition hover:bg-[#FFF7ED]"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type PendingResolve = {
  timeoutId: number;
  toastId: string;
};

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"feedback" | "audit">("feedback");

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshingFeedback, setIsRefreshingFeedback] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "open" | "resolved">("open");
  const [category, setCategory] = useState("");

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [isRefreshingAudit, setIsRefreshingAudit] = useState(false);
  const [auditErr, setAuditErr] = useState("");

  const [aq, setAq] = useState("");
  const [aCategory, setACategory] = useState("");

  const [aTitle, setATitle] = useState("");
  const [aDetails, setADetails] = useState("");
  const [aCreateCategory, setACreateCategory] = useState("other");
  const [aFiles, setAFiles] = useState<File[]>([]);
  const [aCreating, setACreating] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [imgModal, setImgModal] = useState<{ open: boolean; src: string } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingResolveIds, setPendingResolveIds] = useState<Record<string, true>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const feedbackFirstLoadRef = useRef(false);
  const auditFirstLoadRef = useRef(false);
  const feedbackReqIdRef = useRef(0);
  const auditReqIdRef = useRef(0);
  const pendingResolveMapRef = useRef<Record<string, PendingResolve>>({});

  const inputBase =
    "rounded-2xl bg-white border border-[#E5E7EB] px-4 py-3 text-[#1F2937] outline-none transition focus:border-[#F9A8D4] focus:ring-2 focus:ring-[#FCE7F3]";
  const btnBase =
    "rounded-2xl px-4 py-2 border font-extrabold transition active:scale-[0.99] disabled:active:scale-100";
  const btnGhost =
    "bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#FFF7ED] disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF] disabled:hover:bg-[#F9FAFB]";
  const btnPrimary =
    "bg-[#F9A8D4]/30 border-[#F9A8D4]/40 text-[#831843] hover:bg-[#F9A8D4]/40 disabled:bg-[#F9FAFB] disabled:border-[#E5E7EB] disabled:text-[#9CA3AF] disabled:hover:bg-[#F9FAFB]";

  const openCount = useMemo(() => rows.filter((r) => !r.resolved).length, [rows]);

  const auditPreviews = useMemo(
    () =>
      aFiles.map((file) => ({
        key: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [aFiles]
  );

  useEffect(() => {
    return () => {
      auditPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [auditPreviews]);

  const addToast = useCallback(
    ({
      message,
      tone = "ok",
      actionLabel,
      onAction,
      duration = 3500,
    }: {
      message: string;
      tone?: ToastTone;
      actionLabel?: string;
      onAction?: () => void;
      duration?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, tone, actionLabel, onAction }]);

      if (duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchRows = useCallback(
    async ({
      search = q,
      currentStatus = status,
      currentCategory = category,
      initial = false,
      background = false,
    }: {
      search?: string;
      currentStatus?: "" | "open" | "resolved";
      currentCategory?: string;
      initial?: boolean;
      background?: boolean;
    } = {}) => {
      const reqId = ++feedbackReqIdRef.current;

      try {
        setErr("");

        if (initial) {
          setLoading(true);
        } else if (background) {
          setIsRefreshingFeedback(true);
        } else {
          setLoading(true);
        }

        const res = await listFeedback({
          q: search.trim() || undefined,
          status: currentStatus || undefined,
          category: currentCategory || undefined,
          limit: 300,
        });

        if (reqId !== feedbackReqIdRef.current) return;
        setRows(res);
      } catch {
        if (reqId !== feedbackReqIdRef.current) return;
        setErr("Failed to load feedback (token expired or server offline).");
      } finally {
        if (reqId !== feedbackReqIdRef.current) return;
        setLoading(false);
        setIsRefreshingFeedback(false);
      }
    },
    [q, status, category]
  );

  const fetchAudit = useCallback(
    async ({
      search = aq,
      currentCategory = aCategory,
      initial = false,
      background = false,
    }: {
      search?: string;
      currentCategory?: string;
      initial?: boolean;
      background?: boolean;
    } = {}) => {
      const reqId = ++auditReqIdRef.current;

      try {
        setAuditErr("");

        if (initial) {
          setAuditLoading(true);
        } else if (background) {
          setIsRefreshingAudit(true);
        } else {
          setAuditLoading(true);
        }

        const res = await listAudit({
          q: search.trim() || undefined,
          category: currentCategory || undefined,
          limit: 300,
        });

        if (reqId !== auditReqIdRef.current) return;
        setAuditRows(res);
      } catch {
        if (reqId !== auditReqIdRef.current) return;
        setAuditErr("Failed to load audit trail (token expired or server offline).");
      } finally {
        if (reqId !== auditReqIdRef.current) return;
        setAuditLoading(false);
        setIsRefreshingAudit(false);
      }
    },
    [aq, aCategory]
  );

  const clearFeedbackFilters = () => {
    setQ("");
    setStatus("open");
    setCategory("");
  };

  const clearAuditFilters = () => {
    setAq("");
    setACategory("");
  };

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
      addToast({ message: "Title is too short.", tone: "warn" });
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

      if (fileInputRef.current) fileInputRef.current.value = "";

      addToast({ message: "Audit entry created successfully.", tone: "ok" });

      if (tab === "audit") {
        await fetchAudit({ background: true });
      }
    } catch {
      addToast({ message: "Create audit failed. Check server or token.", tone: "danger" });
    } finally {
      setACreating(false);
    }
  };

  const undoResolve = useCallback((id: string) => {
    const pending = pendingResolveMapRef.current[id];
    if (!pending) return;

    window.clearTimeout(pending.timeoutId);
    delete pendingResolveMapRef.current[id];

    setPendingResolveIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, resolved: false } : row)));
  }, []);

  const commitResolve = useCallback(
    async (id: string) => {
      try {
        await resolveFeedback(id);

        setPendingResolveIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        delete pendingResolveMapRef.current[id];

        addToast({ message: "Feedback marked as resolved.", tone: "ok" });
        await fetchRows({ background: true });
      } catch {
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, resolved: false } : row)));

        setPendingResolveIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        delete pendingResolveMapRef.current[id];

        addToast({ message: "Resolve failed. Changes were reverted.", tone: "danger", duration: 4500 });
      }
    },
    [addToast, fetchRows]
  );

  const markResolved = useCallback(
    (id: string) => {
      if (pendingResolveMapRef.current[id]) return;

      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, resolved: true } : row)));
      setPendingResolveIds((prev) => ({ ...prev, [id]: true }));

      const toastId = addToast({
        message: `Marked as resolved. Undo available for ${RESOLVE_UNDO_MS / 1000}s.`,
        tone: "ok",
        actionLabel: "Undo",
        onAction: () => undoResolve(id),
        duration: RESOLVE_UNDO_MS,
      });

      const timeoutId = window.setTimeout(() => {
        commitResolve(id);
        removeToast(toastId);
      }, RESOLVE_UNDO_MS);

      pendingResolveMapRef.current[id] = { timeoutId, toastId };
    },
    [addToast, commitResolve, removeToast, undoResolve]
  );

  const exportCsv = async () => {
    const token = getToken();
    if (!token) {
      addToast({ message: "Missing token. Please log in again.", tone: "warn" });
      return;
    }

    try {
      setIsExporting(true);

      const API = process.env.NEXT_PUBLIC_API_BASE!;
      const res = await fetch(`${API}/admin/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        addToast({ message: "Export failed.", tone: "danger" });
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
      addToast({ message: "CSV exported successfully.", tone: "ok" });
    } catch {
      addToast({ message: "Export failed.", tone: "danger" });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (tab === "feedback" && !feedbackFirstLoadRef.current) {
      feedbackFirstLoadRef.current = true;
      fetchRows({ initial: true });
    }

    if (tab === "audit" && !auditFirstLoadRef.current) {
      auditFirstLoadRef.current = true;
      fetchAudit({ initial: true });
    }
  }, [tab, fetchRows, fetchAudit]);

  useEffect(() => {
    if (tab !== "feedback" || !feedbackFirstLoadRef.current) return;

    const t = window.setTimeout(() => {
      fetchRows({ background: true });
    }, 400);

    return () => window.clearTimeout(t);
  }, [q, status, category, tab, fetchRows]);

  useEffect(() => {
    if (tab !== "audit" || !auditFirstLoadRef.current) return;

    const t = window.setTimeout(() => {
      fetchAudit({ background: true });
    }, 400);

    return () => window.clearTimeout(t);
  }, [aq, aCategory, tab, fetchAudit]);

  useEffect(() => {
    if (!imgModal?.open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImgModal(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [imgModal]);

  useEffect(() => {
    return () => {
      Object.values(pendingResolveMapRef.current).forEach((item) => {
        window.clearTimeout(item.timeoutId);
      });
    };
  }, []);

  const ImgModal = () => {
    if (!imgModal?.open) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setImgModal(null)}
      >
        <div
          className="w-full max-w-4xl rounded-3xl border border-[#E5E7EB] bg-white p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <img src={imgModal.src} alt="attachment" className="h-auto w-full rounded-2xl" />
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setImgModal(null)}
              className="rounded-2xl border border-[#E5E7EB] bg-[#FFF7ED] px-4 py-2 font-extrabold text-[#374151] transition hover:bg-[#FCE7F3]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const feedbackHasFilters = !!q.trim() || !!status || !!category;
  const auditHasFilters = !!aq.trim() || !!aCategory;

  return (
    <div className="min-h-screen text-[#1F2937]">
      <Toasts items={toasts} onClose={removeToast} />
      <ImgModal />

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,168,212,0.25),_transparent_30%),radial-gradient(circle_at_20%_70%,_rgba(147,197,253,0.18),_transparent_25%),radial-gradient(circle_at_80%_85%,_rgba(253,230,138,0.22),_transparent_28%),linear-gradient(135deg,_#FFF9F2_0%,_#FFF7ED_45%,_#FDF2F8_100%)]" />
      </div>

      <div className="sticky top-0 z-20 border-b border-[#F3E8FF] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#F9A8D4]/30 bg-[#FCE7F3] shadow-sm">
              <span className="font-black text-[#BE185D]">SS</span>
            </div>

            <div>
              <div className="text-lg font-black leading-tight text-[#1F2937]">
                {tab === "feedback" ? "Feedback Inbox" : "Audit Trail"}
              </div>
              <div className="mt-0.5 text-xs text-[#6B7280]">
                {tab === "feedback"
                  ? `Open: ${openCount} • Total: ${rows.length}`
                  : `Total: ${auditRows.length}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tab === "feedback" && (
              <button
                onClick={exportCsv}
                disabled={isExporting || loading || isRefreshingFeedback}
                className={clsx(btnBase, btnGhost)}
              >
                {isExporting ? "Exporting..." : "Export CSV"}
              </button>
            )}

            <button
              onClick={() =>
                tab === "feedback"
                  ? fetchRows({ background: true })
                  : fetchAudit({ background: true })
              }
              disabled={
                tab === "feedback"
                  ? loading || isRefreshingFeedback
                  : auditLoading || isRefreshingAudit
              }
              className={clsx(btnBase, btnPrimary)}
            >
              {tab === "feedback"
                ? loading || isRefreshingFeedback
                  ? "Refreshing..."
                  : "Refresh"
                : auditLoading || isRefreshingAudit
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button onClick={onLogout} className={clsx(btnBase, btnGhost)}>
              Logout
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-4">
          <div className="inline-flex rounded-2xl border border-[#E5E7EB] bg-white/80 p-1 shadow-sm">
            <button
              onClick={() => setTab("feedback")}
              className={clsx(
                "rounded-xl px-4 py-2 text-sm font-extrabold transition",
                tab === "feedback"
                  ? "border border-[#F9A8D4]/40 bg-[#FCE7F3] text-[#BE185D]"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              )}
            >
              Feedback
            </button>
            <button
              onClick={() => setTab("audit")}
              className={clsx(
                "rounded-xl px-4 py-2 text-sm font-extrabold transition",
                tab === "audit"
                  ? "border border-[#F9A8D4]/40 bg-[#FCE7F3] text-[#BE185D]"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              )}
            >
              Audit Trail
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-5 p-6">
        {tab === "feedback" && (
          <>
            <SectionCard
              title="Filters"
              subtitle="Search and narrow down feedback quickly."
              right={
                <div className="hidden items-center gap-3 text-xs text-[#6B7280] md:flex">
                  <span className="inline-flex items-center gap-2">
                    {(loading || isRefreshingFeedback) && <InlineSpinner />}
                    <span>Live search</span>
                  </span>
                  <button
                    onClick={clearFeedbackFilters}
                    className="font-extrabold text-[#BE185D] transition hover:text-[#831843]"
                  >
                    Clear filters
                  </button>
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-4">
                <div className="relative">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search text…"
                    className={clsx(inputBase, "w-full pr-10")}
                  />
                  {(loading || isRefreshingFeedback) && (
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <InlineSpinner />
                    </div>
                  )}
                </div>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "" | "open" | "resolved")}
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

                <button
                  onClick={clearFeedbackFilters}
                  className={clsx(btnBase, btnGhost, "py-3 md:hidden")}
                >
                  Clear filters
                </button>
              </div>

              {feedbackHasFilters && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {!!q.trim() && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="inline-flex items-center gap-2 rounded-full border border-[#F9A8D4]/40 bg-[#FCE7F3] px-3 py-1.5 text-xs font-extrabold text-[#BE185D] transition hover:bg-[#F9A8D4]/20"
                    >
                      Search: {q.trim()} <span>✕</span>
                    </button>
                  )}

                  {!!status && (
                    <button
                      type="button"
                      onClick={() => setStatus("")}
                      className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-extrabold text-[#374151] transition hover:bg-[#FFF7ED]"
                    >
                      Status: {status} <span>✕</span>
                    </button>
                  )}

                  {!!category && (
                    <button
                      type="button"
                      onClick={() => setCategory("")}
                      className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-extrabold text-[#374151] transition hover:bg-[#FFF7ED]"
                    >
                      Category: {category} <span>✕</span>
                    </button>
                  )}
                </div>
              )}

              {!!err && (
                <div className="mt-3 rounded-2xl border border-[#FCA5A5]/40 bg-[#FEE2E2] px-4 py-3 text-sm text-[#B91C1C]">
                  <div>{err}</div>
                  <button
                    type="button"
                    onClick={() => fetchRows({ background: true })}
                    className="mt-2 font-extrabold text-[#B91C1C] underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              )}
            </SectionCard>

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
                  {(loading || isRefreshingFeedback) && <InlineSpinner />}
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
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFDF8] p-8 text-center">
                  <div className="text-base font-black text-[#1F2937]">No feedback found</div>
                  <div className="mt-1 text-sm text-[#6B7280]">
                    {feedbackHasFilters
                      ? "Try clearing filters or changing your search."
                      : "No feedback entries are available yet."}
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

                    const isPendingResolve = !!pendingResolveIds[r.id];

                    return (
                      <div
                        key={r.id}
                        className="rounded-3xl border border-[#E5E7EB] bg-white/85 p-4 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill tone={catTone}>{cat}</Pill>
                              <span className="text-xs text-[#6B7280]">
                                {new Date(r.created_at).toLocaleString()}
                              </span>
                              <span className="text-xs text-[#D1D5DB]">•</span>
                              <span className="text-xs text-[#6B7280]">
                                {r.platform ?? "-"} • {r.app_version ?? "-"} • {r.device ?? "-"}
                              </span>
                            </div>

                            <div className="mt-2 break-words text-sm font-black text-[#1F2937]">
                              <ExpandableText text={r.message} previewChars={190} />
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <Pill>{r.rating ?? "-"}</Pill>
                              {r.resolved ? (
                                <Pill tone="ok">{isPendingResolve ? "resolving…" : "resolved"}</Pill>
                              ) : (
                                <Pill tone="warn">open</Pill>
                              )}
                              {isPendingResolve && <Pill tone="warn">undo available</Pill>}
                            </div>

                            {(r.image_urls?.length ?? 0) > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {r.image_urls!.map((u) => {
                                  const src = absoluteUrl(u);
                                  return (
                                    <img
                                      key={u}
                                      src={src}
                                      alt="attachment"
                                      className="h-16 w-16 cursor-pointer rounded-2xl border border-[#E5E7EB] object-cover transition hover:scale-[1.02] hover:opacity-90"
                                      onClick={() => setImgModal({ open: true, src })}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0">
                            {r.resolved ? (
                              isPendingResolve ? (
                                <button
                                  onClick={() => undoResolve(r.id)}
                                  className={clsx(btnBase, btnGhost)}
                                >
                                  Undo
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className={clsx(
                                    btnBase,
                                    "cursor-not-allowed border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF]"
                                  )}
                                >
                                  Resolved
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => markResolved(r.id)}
                                disabled={!!pendingResolveIds[r.id]}
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

        {tab === "audit" && (
          <>
            <SectionCard
              title="Create audit entry"
              subtitle="Use this when you fixed or changed something. Optional images allowed."
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

                  <div className="text-xs text-[#6B7280]">{aFiles.length}/3 selected</div>
                </div>

                <div className="flex-1" />

                <button
                  onClick={createAudit}
                  disabled={aCreating}
                  className={clsx(btnBase, aCreating ? btnGhost : btnPrimary)}
                >
                  {aCreating ? "Creating..." : "Create"}
                </button>
              </div>

              {auditPreviews.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {auditPreviews.map((preview) => (
                    <div
                      key={preview.key}
                      className="group relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
                    >
                      <img
                        src={preview.url}
                        alt={preview.name}
                        className="h-24 w-24 object-cover"
                        onClick={() => setImgModal({ open: true, src: preview.url })}
                      />
                      <button
                        type="button"
                        onClick={() => removeAuditFile(preview.name)}
                        className="absolute right-2 top-2 rounded-full border border-white/60 bg-black/55 px-2 py-1 text-[10px] font-black text-white transition hover:bg-black/70"
                      >
                        Remove
                      </button>
                      <div className="max-w-[96px] truncate px-2 py-1 text-[10px] font-bold text-[#6B7280]">
                        {preview.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Filters"
              subtitle="Search audit entries by title/details and category."
              right={
                <div className="hidden items-center gap-3 text-xs text-[#6B7280] md:flex">
                  <span className="inline-flex items-center gap-2">
                    {(auditLoading || isRefreshingAudit) && <InlineSpinner />}
                    <span>Live search</span>
                  </span>
                  <button
                    onClick={clearAuditFilters}
                    className="font-extrabold text-[#BE185D] transition hover:text-[#831843]"
                  >
                    Clear filters
                  </button>
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative">
                  <input
                    value={aq}
                    onChange={(e) => setAq(e.target.value)}
                    placeholder="Search title/details…"
                    className={clsx(inputBase, "w-full pr-10")}
                  />
                  {(auditLoading || isRefreshingAudit) && (
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <InlineSpinner />
                    </div>
                  )}
                </div>

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

                <button
                  onClick={clearAuditFilters}
                  className={clsx(btnBase, btnGhost, "py-3 md:hidden")}
                >
                  Clear filters
                </button>
              </div>

              {auditHasFilters && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {!!aq.trim() && (
                    <button
                      type="button"
                      onClick={() => setAq("")}
                      className="inline-flex items-center gap-2 rounded-full border border-[#F9A8D4]/40 bg-[#FCE7F3] px-3 py-1.5 text-xs font-extrabold text-[#BE185D] transition hover:bg-[#F9A8D4]/20"
                    >
                      Search: {aq.trim()} <span>✕</span>
                    </button>
                  )}

                  {!!aCategory && (
                    <button
                      type="button"
                      onClick={() => setACategory("")}
                      className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-extrabold text-[#374151] transition hover:bg-[#FFF7ED]"
                    >
                      Category: {aCategory} <span>✕</span>
                    </button>
                  )}
                </div>
              )}

              {!!auditErr && (
                <div className="mt-3 rounded-2xl border border-[#FCA5A5]/40 bg-[#FEE2E2] px-4 py-3 text-sm text-[#B91C1C]">
                  <div>{auditErr}</div>
                  <button
                    type="button"
                    onClick={() => fetchAudit({ background: true })}
                    className="mt-2 font-extrabold text-[#B91C1C] underline underline-offset-2"
                  >
                    Retry
                  </button>
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Audit entries"
              subtitle="Newest first."
              right={
                <div className="flex items-center gap-2">
                  {(auditLoading || isRefreshingAudit) && <InlineSpinner />}
                  <Pill>{auditRows.length} total</Pill>
                </div>
              }
            >
              {auditLoading ? (
                <div className="space-y-3">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : auditRows.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFDF8] p-8 text-center">
                  <div className="text-base font-black text-[#1F2937]">No audit entries yet</div>
                  <div className="mt-1 text-sm text-[#6B7280]">
                    {auditHasFilters
                      ? "Try clearing filters or changing your search."
                      : "Create one above to start logging changes."}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditRows.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-3xl border border-[#E5E7EB] bg-white/85 p-4 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone="ok">{(a.category || "other").toString()}</Pill>
                            <span className="text-xs text-[#6B7280]">
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="mt-2 text-sm font-black text-[#1F2937]">
                            <ExpandableText text={a.title} previewChars={110} />
                          </div>

                          {!!a.details && (
                            <div className="mt-1 break-words whitespace-pre-wrap text-sm text-[#6B7280]">
                              <ExpandableText text={a.details} previewChars={220} />
                            </div>
                          )}

                          {(a.image_urls?.length ?? 0) > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {a.image_urls!.map((u) => {
                                const src = absoluteUrl(u);
                                return (
                                  <img
                                    key={u}
                                    src={src}
                                    alt="attachment"
                                    className="h-16 w-16 cursor-pointer rounded-2xl border border-[#E5E7EB] object-cover transition hover:scale-[1.02] hover:opacity-90"
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

        <div className="pb-10 text-center text-xs text-[#6B7280]">
          SignSight Admin • Powered by FastAPI + MongoDB
        </div>
      </div>
    </div>
  );
}
