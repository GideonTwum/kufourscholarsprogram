"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDirectorRole, dashboardPathForRole } from "@/lib/roles";
import { isProfileActive } from "@/lib/staff-lifecycle";
import {
  MFA_SETUP_PATH,
  listDirectorTotpFactors,
  resolveDirectorMfaDestination,
} from "@/lib/director-mfa";

export default function DirectorMfaChallengePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/director-login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (!isDirectorRole(profile?.role) || !isProfileActive(profile)) {
        router.replace(
          profile?.role ? dashboardPathForRole(profile.role) : "/login"
        );
        return;
      }

      const dest = await resolveDirectorMfaDestination(supabase);
      if (cancelled) return;
      if (dest === "ok") {
        router.replace("/director");
        return;
      }
      if (dest === "setup") {
        router.replace(MFA_SETUP_PATH);
        return;
      }

      const { verifiedTotp, error: listErr } = await listDirectorTotpFactors(supabase);
      if (listErr || !verifiedTotp[0]?.id) {
        router.replace(MFA_SETUP_PATH);
        return;
      }

      if (!cancelled) {
        setFactorId(verifiedTotp[0].id);
        setLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    if (submitting || !factorId) return;
    const trimmed = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeErr || !challenge?.id) {
      setError("Could not start challenge. Wait a moment and try again.");
      setSubmitting(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: trimmed,
    });

    if (verifyErr) {
      setError("Invalid or expired code. Try again.");
      setCode("");
      setSubmitting(false);
      return;
    }

    router.replace("/director");
    router.refresh();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/director-login");
  }

  if (loading) {
    return (
      <div className="flex justify-center rounded-2xl bg-white p-12 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <Shield size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Director verification</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </div>

      <form onSubmit={handleVerify} className="mt-8 space-y-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-center text-lg tracking-widest outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          placeholder="000000"
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white hover:bg-royal-light disabled:opacity-50"
        >
          {submitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-6 w-full text-center text-sm text-royal underline"
      >
        Sign out
      </button>
    </div>
  );
}
