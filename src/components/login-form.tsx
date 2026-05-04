"use client";
import Image from "next/image";
import { useState } from "react";

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
}

export default function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <Image
            src="/martino%20logo.png"
            alt="Martino Noir"
            width={220}
            height={140}
            priority
            className="h-auto w-[220px] invert"
          />
          <p className="text-amber-400 font-medium text-sm tracking-[0.3em] uppercase mt-3">
            Point of Sale
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="staff@martinonoir.com"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold text-base rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-zinc-700 text-xs mt-8">
          Staff login only — Contact admin for access
        </p>
      </div>
    </div>
  );
}
