"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginPathForRole } from "@/lib/portal-auth";
import { validatePasswordPolicy } from "@/lib/password-policy";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (userErr || !user) {
        setSessionOk(false);
        setChecking(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setLoginHref(loginPathForRole(profile?.role) || "/login");
        setSessionOk(true);
        setChecking(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const policy = validatePasswordPolicy(password);
    if (!policy.ok) {
      setError(policy.message);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (loading) return;

    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(
        updErr.message?.toLowerCase().includes("session")
          ? "This reset link is invalid or has expired. Request a new password reset."
          : "Could not update password. Request a new reset link and try again."
      );
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let href = "/login";
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      href = loginPathForRole(profile?.role) || "/login";
    }

    await supabase.auth.signOut();
    router.replace(`${href}?reset=1`);
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex justify-center rounded-2xl bg-white p-12 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-royal" />
      </div>
    );
  }

  if (!sessionOk) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            This password reset link is invalid or has expired. Please request a new reset email.
          </span>
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-gold-dark hover:text-gold">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <Lock size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Choose a new password</h1>
        <p className="mt-2 text-sm text-gray-500">
          Use at least 8 characters with a letter and a number. After saving, you will sign in
          again.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">New password</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
          <input
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white hover:bg-royal-light disabled:opacity-50"
        >
          {loading ? "Saving…" : "Update password"}
        </button>

        <p className="text-center text-xs text-gray-400">
          After reset you will return to{" "}
          <Link href={loginHref} className="underline hover:text-royal">
            your portal login
          </Link>
          . Resetting a password does not reactivate a deactivated staff account.
        </p>
      </form>
    </div>
  );
}
