"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { assertLoginPortalRole, portalHomeForRole } from "@/lib/portal-auth";

const PROFILE_COLUMNS = "id, email, full_name, role, is_active";

function isDev() {
  return process.env.NODE_ENV === "development";
}

/** Safe subset of PostgREST/Supabase errors — never tokens/passwords/keys. */
function summarizeProfileError(err) {
  if (!err) return null;
  return {
    code: err.code || null,
    message: err.message || null,
    details: err.details || null,
    hint: err.hint || null,
  };
}

function formatProfileLoadError(err) {
  const summary = summarizeProfileError(err);
  const base =
    "Could not load your account profile (database permissions). Ask the technical team to apply the profiles RLS migration.";
  if (!isDev() || !summary) return base;
  let host = null;
  try {
    host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname || null;
  } catch {
    host = null;
  }
  const parts = [
    summary.code ? `code=${summary.code}` : null,
    summary.message ? `message=${summary.message}` : null,
    summary.details ? `details=${summary.details}` : null,
    summary.hint ? `hint=${summary.hint}` : null,
    host ? `projectHost=${host}` : null,
  ].filter(Boolean);
  return parts.length ? `${base} [${parts.join(" | ")}]` : base;
}

/**
 * Shared portal login form.
 * @param {{ expectedRole: 'applicant'|'assessor'|'panel'|'director', title: string, subtitle: string, footer?: import('react').ReactNode }} props
 */
export default function PortalLoginForm({ expectedRole, title, subtitle, footer }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      await supabase.auth.signOut();
      setError("Sign-in succeeded but no user id was returned. Try again.");
      setLoading(false);
      return;
    }

    // Source of truth: profiles.id = auth.users.id (never email / user_metadata for authz)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      const summary = summarizeProfileError(profileError);
      console.error("[portal-login] profiles select failed", summary);
      await supabase.auth.signOut();
      setError(formatProfileLoadError(profileError));
      setLoading(false);
      return;
    }

    // maybeSingle: 0 rows → profile null, error null (RLS filter or missing row — not .single())
    if (!profile?.role) {
      console.error("[portal-login] profiles row missing or role empty", {
        userIdPresent: Boolean(userId),
        profileNull: profile == null,
      });
      await supabase.auth.signOut();
      setError("Your account profile could not be verified. Contact support.");
      setLoading(false);
      return;
    }

    if (
      (profile.role === "panel" || profile.role === "assessor" || profile.role === "director") &&
      profile.is_active === false
    ) {
      await supabase.auth.signOut();
      setError(
        "This account has been deactivated. Contact the program director if you need access restored."
      );
      setLoading(false);
      return;
    }

    const role = profile.role;
    const check = assertLoginPortalRole(role, expectedRole);

    if (!check.ok) {
      await supabase.auth.signOut();
      setError(check.message);
      setLoading(false);
      return;
    }

    if (
      expectedRole === "applicant" &&
      (role === "applicant" || role === "scholar") &&
      data.user.email_confirmed_at == null
    ) {
      router.push("/applicant/verify-email");
      router.refresh();
      setLoading(false);
      return;
    }

    router.push(portalHomeForRole(role));
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <LogIn size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
      </div>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Email Address</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-light disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {footer ? <div className="mt-6 text-center text-sm text-gray-500">{footer}</div> : null}

      <p className="mt-4 text-center text-xs text-gray-400">
        Wrong portal?{" "}
        <Link href="/login" className="underline hover:text-royal">
          Applicant
        </Link>
        {" · "}
        <Link href="/assessor-login" className="underline hover:text-royal">
          Assessor
        </Link>
        {" · "}
        <Link href="/panel-login" className="underline hover:text-royal">
          Panel
        </Link>
        {" · "}
        <Link href="/director-login" className="underline hover:text-royal">
          Director
        </Link>
      </p>
    </div>
  );
}
