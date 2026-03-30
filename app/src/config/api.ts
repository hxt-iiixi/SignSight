const FALLBACK_API_BASE = "http://127.0.0.1:8000";

function normalizeApiBase(value?: string) {
  const base = (value || FALLBACK_API_BASE).trim();
  return base.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(process.env.EXPO_PUBLIC_API_BASE);

