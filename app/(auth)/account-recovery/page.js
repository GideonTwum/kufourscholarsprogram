"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, User, Phone, AlertCircle, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import {
  ACCOUNT_RECOVERY_FAILURE_MESSAGE,
  ACCOUNT_RECOVERY_RATE_LIMIT_MESSAGE,
  ACCOUNT_RECOVERY_SUCCESS_MESSAGE,
} from "@/lib/applicant-account-recovery";

export default function AccountRecoveryPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (loading || cooldownSec > 0) return;

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedEmail || !trimmedName || !trimmedPhone) {
      setError(ACCOUNT_RECOVERY_FAILURE_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/account-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          fullName: trimmedName,
          phone: trimmedPhone,
        }),
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
        setError(json.message || ACCOUNT_RECOVERY_RATE_LIMIT_MESSAGE);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(json.message || ACCOUNT_RECOVERY_FAILURE_MESSAGE);
        setLoading(false);
        return;
      }

      const message = typeof json.message === "string" ? json.message : "";
      if (message === ACCOUNT_RECOVERY_SUCCESS_MESSAGE) {
        setDone(true);
      } else {
        setError(message || ACCOUNT_RECOVERY_FAILURE_MESSAGE);
      }
    } catch {
      setError(ACCOUNT_RECOVERY_FAILURE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-royal/10">
          <KeyRound size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Applicant Account Recovery</h1>
        <p className="mt-2 text-sm text-gray-500">
          Having trouble verifying your email or accessing your application? Enter the same details
          you used when creating your application account.
        </p>
      </div>

      {done ? (
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <span>{ACCOUNT_RECOVERY_SUCCESS_MESSAGE}</span>
          </div>
          <p className="text-center text-sm text-gray-500">
            <Link href="/login" className="font-semibold text-gold-dark hover:text-gold">
              Back to Applicant Login
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Registered Email Address
            </label>
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                placeholder="As on your application"
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone Number</label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="e.g. 0241234567"
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
          </div>

          <p className="text-xs leading-relaxed text-gray-500">
            For your security, the information provided must match the details associated with your
            existing application.
          </p>

          <button
            type="submit"
            disabled={loading || cooldownSec > 0}
            className="w-full rounded-lg bg-royal py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-light disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Processing…
              </span>
            ) : cooldownSec > 0 ? (
              `Wait ${cooldownSec}s`
            ) : (
              "Recover My Account"
            )}
          </button>

          <div className="space-y-2 text-center text-sm text-gray-500">
            <p>
              Already have access?{" "}
              <Link href="/login" className="font-semibold text-gold-dark hover:text-gold">
                Back to Applicant Login
              </Link>
            </p>
            <p>
              <Link
                href="/applicant/verify-email"
                className="font-medium text-gold-dark hover:text-gold"
              >
                Resend Verification Email
              </Link>
              {" · "}
              <Link
                href="/forgot-password?portal=applicant"
                className="font-medium text-gold-dark hover:text-gold"
              >
                Forgot Password
              </Link>
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
