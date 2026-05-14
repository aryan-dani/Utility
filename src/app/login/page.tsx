"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // Stable client — created once per mount, not on every render
  const supabase = useMemo(() => createClient(), []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Hard navigation ensures the server-side middleware cookie is picked up
      window.location.href = "/admin";
    }
  };

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm p-6 bg-surface border border-border rounded-lg shadow-sm"
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>

        {error && (
          <div className="mb-4 text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-primary"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-2 rounded hover:bg-primary-hover disabled:opacity-50 transition"
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
