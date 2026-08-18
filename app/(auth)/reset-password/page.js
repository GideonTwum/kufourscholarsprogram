"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginPathForRole } from "@/lib/portal-auth";
import PasswordPolicyChecklist from "@/components/auth/PasswordPolicyChecklist";
import {
  PASSWORD_POLICY_MESSAGE,
  passwordsMatch,
  validatePasswordPolicy,
} from "@/lib/password-policy";

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

  const policy = useMemo(() => validatePasswordPolicy(password), [password]);
  const confirmOk = passwordsMatch(password, confirm);
  const confirmTouched = confirm.length > 0;
  const canSubmit = policy.valid && confirmOk && !loading;

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

    const gate = validatePasswordPolicy(password);
    if (!gate.ok) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!passwordsMatch(password, confirm)) {
      setError("Passwords do not match.");
      return;
    }
    if (loading) return;

    setLoading(true);
    // Password is passed exactly as typed — never trimmed or lowercased.
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
    <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <Lock size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Choose a new password</h1>
        <p className="mt-2 text-sm text-gray-500">
          Use at least 8 characters with uppercase, lowercase, a number, and a special
          character. After saving, you will sign in again.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
        {error ? (
          <div
            className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"
            role="alert"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium text-gray-700">
            New password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-describedby="password-requirements"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <PasswordPolicyChecklist password={password} />
        </div>

        <div>
          <label
            htmlFor="reset-confirm-password"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Confirm password
          </label>
          <input
            id="reset-confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            aria-invalid={confirmTouched && !confirmOk}
            aria-describedby={
              confirmTouched ? "reset-confirm-password-feedback" : undefined
            }
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          {confirmTouched ? (
            <p
              id="reset-confirm-password-feedback"
              className={`mt-2 flex items-center gap-1.5 text-xs sm:text-sm ${
                confirmOk ? "text-green-700" : "text-red-600"
              }`}
              aria-live="polite"
            >
              {confirmOk ? (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Passwords match
                </>
              ) : (
                <>
                  <AlertCircle size={14} aria-hidden="true" />
                  Passwords do not match
                </>
              )}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white hover:bg-royal-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:opacity-50"
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
