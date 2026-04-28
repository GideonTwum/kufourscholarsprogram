"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function VerifyEmailContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function run() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");
      if (user.email_confirmed_at) {
        router.replace("/applicant");
        return;
      }
      setLoading(false);
    }
    run();
  }, [router, supabase.auth]);

  async function handleResend() {
    setError(null);
    setMessage(null);
    setResending(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("You are not signed in.");
      setResending(false);
      return;
    }
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=/applicant`
            : undefined,
      },
    });
    if (err) {
      setError(err.message);
    } else {
      setMessage("Verification email sent. Please check your inbox.");
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
        <h1 className="mt-4 text-xl font-bold text-gray-900">Verify your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          Please verify your email before continuing.
        </p>
        {registered && (
          <p className="mt-2 text-sm text-gray-500">
            We sent a link to <strong>{email || "your address"}</strong>. Open it to activate your account.
          </p>
        )}
      </div>

      {email && (
        <p className="mt-6 rounded-lg bg-gray-50 px-4 py-2 text-center text-sm text-gray-700">
          Signed in as <span className="font-medium">{email}</span>
        </p>
      )}

      {!email && (
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/login" className="font-semibold text-royal hover:text-gold">
            Sign in
          </Link>{" "}
          after you have verified — or open the verification link from your email.
        </p>
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

      {email && (
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="mt-6 w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal/90 disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend verification email"}
        </button>
      )}

      <p className="mt-6 text-center text-xs text-gray-400">
        Wrong account?{" "}
        <button
          type="button"
          onClick={() => supabase.auth.signOut().then(() => router.push("/login"))}
          className="font-semibold text-royal hover:text-gold"
        >
          Sign out
        </button>
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
