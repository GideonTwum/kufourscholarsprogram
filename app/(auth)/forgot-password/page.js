"use client";

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  isValidEmailFormat,
  loginPathForRecoveryPortal,
  normalizeRecoveryPortal,
  passwordResetCallbackUrl,
} from "@/lib/auth-recovery";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const portal = useMemo(
    () => normalizeRecoveryPortal(searchParams.get("portal")),
    [searchParams]
  );
  const loginHref = loginPathForRecoveryPortal(portal);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isValidEmailFormat(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (loading || cooldownSec > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), portal }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const wait = Number(json.retryAfterSec) || 60;
        setCooldownSec(wait);
        const timer = setInterval(() => {
          setCooldownSec((s) => {
            if (s <= 1) {
              clearInterval(timer);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
        setError("Please wait before requesting another reset email.");
        setLoading(false);
        return;
      }

      // Always show the same success message (enumeration-safe).
      // Client fallback if API is unavailable: still call Supabase without revealing outcome.
      if (!res.ok && res.status >= 500) {
        const supabase = createClient();
        await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: passwordResetCallbackUrl(
            typeof window !== "undefined" ? window.location.origin : ""
          ),
        });
      }

      setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <Mail size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Reset password</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enter the email for your {portal} account. We will send reset instructions if an account
          exists.
        </p>
      </div>

      {done ? (
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{FORGOT_PASSWORD_SUCCESS_MESSAGE}</span>
          </div>
          <p className="text-center text-sm text-gray-500">
            <Link href={loginHref} className="font-semibold text-gold-dark hover:text-gold">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || cooldownSec > 0}
            className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-light disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Sending…
              </span>
            ) : cooldownSec > 0 ? (
              `Wait ${cooldownSec}s`
            ) : (
              "Send reset instructions"
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link href={loginHref} className="font-semibold text-gold-dark hover:text-gold">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center rounded-2xl bg-white p-12 shadow-xl">
          <Loader2 className="h-8 w-8 animate-spin text-royal" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
