"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const label = "block text-sm font-medium text-stone-700";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onResetPassword() {
    if (!email.trim()) {
      setError("Enter your email first, then tap Reset password.");
      setInfo(null);
      return;
    }
    setResetting(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/login/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setResetting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setInfo("Password reset email sent. Check your inbox and follow the link.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className={label}>Email</label>
        <input
          className={field}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className={label}>Password</label>
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-xs font-semibold text-emerald-700"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <input
          className={field}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-emerald-700 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={onResetPassword}
        disabled={resetting}
        className="w-full rounded-xl border border-stone-300 bg-white py-3 text-base font-semibold text-stone-700 disabled:opacity-60"
      >
        {resetting ? "Sending…" : "Reset password"}
      </button>
      <p className="text-center text-xs text-stone-500">
        After reset, you&apos;ll set a new password on the{" "}
        <Link href="/login/reset-password" className="font-semibold text-emerald-700">
          update page
        </Link>
        .
      </p>
    </form>
  );
}
