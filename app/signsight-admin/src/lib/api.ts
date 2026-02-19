const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  // CSV export returns text, but we won't use apiFetch for that
  return (await res.json()) as T;
}

export async function adminLogin(username: string, password: string) {
  return apiFetch<{ ok: boolean; token: string }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export type FeedbackRow = {
  id: string;
  created_at: string;
  message: string;
  category: string;
  rating?: number | null;
  device?: string | null;
  app_version?: string | null;
  platform?: string | null;
  status: "open" | "resolved";
  resolved: boolean;
};

export async function listFeedback(params: {
  q?: string;
  status?: "open" | "resolved" | "";
  category?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  qs.set("limit", String(params.limit ?? 200));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<FeedbackRow[]>(`/admin/feedback${query}`);
}

export async function resolveFeedback(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/feedback/${id}/resolve`, { method: "POST" });
}

export function exportCsvUrl() {
  const token = getToken();
  // easiest: open with token via Authorization header is not possible in <a>.
  // So we’ll export with a fetch in the UI and download locally.
  return `${API_BASE}/admin/export.csv`;
}
