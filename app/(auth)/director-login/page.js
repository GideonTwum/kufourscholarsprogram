"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function DirectorLoginPage() {
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
      const msg = authError.message || "";
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        setError(
          "Cannot reach Supabase from this browser. Confirm your Supabase project is not paused (Dashboard → Restore), NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local match Dashboard → Settings → API, restart dev server, and try again.",
        );
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    // Prefer DB role; fallback to JWT user_metadata from signup (e.g. createUser adds role).
    // If profiles RLS errors (e.g. recursion) or the row is missing, metadata still allows director login.
    const metaRole =
      typeof data.user?.user_metadata?.role === "string"
        ? data.user.user_metadata.role
        : null;
    const role = profile?.role || metaRole || "applicant";

    if (role !== "director") {
      await supabase.auth.signOut();
      setError(
        "This sign-in is for program directors only. Applicants and interview panel should use Login in the site header (applicant sign in).",
      );
      setLoading(false);
      return;
    }

    router.push("/director");
    router.refresh();
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-xl">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/20">
          <LogIn size={24} className="text-royal" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-royal">Director Sign In</h1>
        <p className="mt-2 text-sm text-gray-500">
          Access the director portal to manage applications and program
          operations
        </p>
      </div>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Email Address
          </label>
          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
          {loading ? "Signing in..." : "Sign In to Director Portal"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        New director?{" "}
        <Link href="/director/signup" className="font-semibold text-royal hover:text-gold">
          Create an account
        </Link>
        {" "}
        (authorized code required). Applying to the program?{" "}
        <Link href="/login" className="font-semibold text-royal hover:text-gold">
          Applicant sign in
        </Link>
        .
      </p>
    </div>
  );
}
