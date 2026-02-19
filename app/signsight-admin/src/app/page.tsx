"use client";

import { useEffect, useState } from "react";
import AdminDashboard from "../components/AdminDashboard";
import { clearToken, getToken, setToken, adminLogin } from "../lib/api";

export default function HomePage() {
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  if (!token) {
    return (
      <Login
        onSuccess={(t) => {
          setToken(t);
          setTokenState(t);
        }}
      />
    );
  }

  return <AdminDashboard onLogout={() => { clearToken(); setTokenState(null); }} />;
}

function Login({ onSuccess }: { onSuccess: (t: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    try {
      setErr("");
      setLoading(true);
      const res = await adminLogin(username, password);
      onSuccess(res.token);
    } catch (e: any) {
      setErr("Invalid login or server offline.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-400/15 border border-emerald-300/25 flex items-center justify-center">
            <span className="text-emerald-300 font-black">SS</span>
          </div>
          <div>
            <div className="text-lg font-black">SignSight Admin</div>
            <div className="text-white/60 text-sm">Feedback dashboard</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <input
            className="w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300/50"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
          <input
            className="w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
          />

          {!!err && <div className="text-red-300 text-sm">{err}</div>}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-emerald-300/20 border border-emerald-300/30 px-4 py-3 font-extrabold hover:bg-emerald-300/25 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Login"}
          </button>

          <div className="text-xs text-white/45 mt-2">
            Uses your FastAPI endpoint <span className="text-white/70">/admin/login</span>
          </div>
        </div>
      </div>
    </div>
  );
}
