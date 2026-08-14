"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const RESEND_KEY = "ksp_verify_resend_at";
const EMAIL_KEY = "ksp_verify_email";

function safeEmailFromQuery(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return trimmed;
}

function applicantVerifyRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  // After the link is opened, callback exchanges the code, signs out, and sends
  // the applicant to Applicant Sign In — not the dashboard.
  return `${window.location.origin}/auth/callback?next=/login`;
}

function VerifyEmailContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const emailFromQuery = safeEmailFromQuery(searchParams.get("email"));

  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState(emailFromQuery);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(RESEND_KEY);
    if (!raw) return;
    const elapsed = Math.floor((Date.now() - Number(raw)) / 1000);
    const left = 60 - elapsed;
    if (left > 0) setCooldownSec(left);
  }, []);

  useEffect(() => {
    if (cooldownSec <= 0) return undefined;
    const t = setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  useEffect(() => {
    async function run() {
      let resolved = emailFromQuery;
      if (!resolved && typeof window !== "undefined") {
        try {
          resolved = safeEmailFromQuery(window.sessionStorage.getItem(EMAIL_KEY) || "");
        } catch {
          /* ignore */
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        resolved = user.email;
      }

      if (resolved) {
        setEmail(resolved);
        try {
          window.sessionStorage.setItem(EMAIL_KEY, resolved);
        } catch {
          /* ignore */
        }
      }

      // Never auto-enter the Applicant Dashboard from this page.
      // Verified applicants must use Applicant Sign In explicitly.
      setLoading(false);
    }
    run();
  }, [emailFromQuery, supabase.auth]);

  async function handleResend() {
    setError(null);
    setMessage(null);
    if (cooldownSec > 0) {
      setError(`Please wait ${cooldownSec}s before requesting another email.`);
      return;
    }

    const target = safeEmailFromQuery(email);
    if (!target) {
      setError("Enter the email you used to register, then try again.");
      return;
    }

    setResending(true);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: target,
      options: {
        emailRedirectTo: applicantVerifyRedirectUrl(),
      },
    });
    if (err) {
      setError("Could not resend verification email. Try again shortly.");
    } else {
      setMessage(
        "If verification is still pending, a new email has been sent. Check your inbox."
      );
      try {
        window.sessionStorage.setItem(RESEND_KEY, String(Date.now()));
        window.sessionStorage.setItem(EMAIL_KEY, target);
      } catch {
        /* ignore */
      }
      setCooldownSec(60);
    }
    setResending(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <Mail size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          We&apos;ve sent a verification link to your email address.
          Open the email and verify your account before signing in.
        </p>
        {registered ? (
          <p className="mt-2 text-sm text-gray-500">
            Your account was created. Verification is required before you can
            access the applicant portal.
          </p>
        ) : null}
      </div>

      {email ? (
        <p className="mt-6 rounded-lg bg-gray-50 px-4 py-2 text-center text-sm text-gray-700">
          Verification email sent to <span className="font-medium">{email}</span>
        </p>
      ) : (
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>
      )}

      {message && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleResend}
        disabled={resending || cooldownSec > 0}
        className="mt-6 w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal/90 disabled:opacity-50"
      >
        {resending
          ? "Sending…"
          : cooldownSec > 0
            ? `Resend available in ${cooldownSec}s`
            : "Resend verification email"}
      </button>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/login" className="font-semibold text-royal hover:text-gold">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-royal" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
