"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import PasswordPolicyChecklist from "@/components/auth/PasswordPolicyChecklist";
import {
  PASSWORD_POLICY_MESSAGE,
  passwordsMatch,
  validatePasswordPolicy,
} from "@/lib/password-policy";
import { isValidEmailFormat } from "@/lib/auth-recovery";

export default function ApplicantRegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const policy = useMemo(() => validatePasswordPolicy(password), [password]);
  const nameOk = fullName.trim().length > 0;
  const emailOk = isValidEmailFormat(email.trim());
  const confirmOk = passwordsMatch(password, confirmPassword);
  const confirmTouched = confirmPassword.length > 0;
  const canSubmit = nameOk && emailOk && policy.valid && confirmOk && !loading;

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (loading) return;

    if (!nameOk) {
      setError("Full name is required.");
      return;
    }
    if (!emailOk) {
      setError("Enter a valid email address.");
      return;
    }

    const gate = validatePasswordPolicy(password);
    if (!gate.ok) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (!passwordsMatch(password, confirmPassword)) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Confirmation link → /auth/callback → sign out → /login?verified=true
    // (never auto-enter the Applicant Dashboard after verification alone).
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=/login`
        : undefined;

    const normalizedEmail = email.trim().toLowerCase();
    // Password is passed exactly as typed — never trimmed or lowercased.
    const { error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "applicant",
        },
        emailRedirectTo: redirectUrl,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    try {
      window.sessionStorage.setItem("ksp_verify_email", normalizedEmail);
    } catch {
      /* ignore */
    }

    const q = new URLSearchParams({
      registered: "1",
      email: normalizedEmail,
    });
    router.push(`/applicant/verify-email?${q.toString()}`);
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <UserPlus size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Applicant registration</h1>
        <p className="mt-2 text-sm text-gray-500">
          Create an account to begin your application. You will receive an email
          verification link after signup — verify your email before continuing.
          For Foundation staff, use the links in the site footer.
        </p>
      </div>

      <form onSubmit={handleRegister} className="mt-8 space-y-5" noValidate>
        {error && (
          <div
            className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"
            role="alert"
          >
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label htmlFor="applicant-full-name" className="mb-1.5 block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <div className="relative">
            <User
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="applicant-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              placeholder="John Doe"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
        </div>

        <div>
          <label htmlFor="applicant-email" className="mb-1.5 block text-sm font-medium text-gray-700">
            Email Address
          </label>
          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="applicant-email"
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

        <div>
          <label htmlFor="applicant-password" className="mb-1.5 block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="applicant-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-describedby="password-requirements"
              placeholder="Create a strong password"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
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
            htmlFor="applicant-confirm-password"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="applicant-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-invalid={confirmTouched && !confirmOk}
              aria-describedby={
                confirmTouched ? "applicant-confirm-password-feedback" : undefined
              }
              placeholder="Re-enter your password"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          {confirmTouched ? (
            <p
              id="applicant-confirm-password-feedback"
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
          className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create applicant account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-royal hover:text-gold"
        >
          Applicant sign in
        </Link>
      </p>
    </div>
  );
}
