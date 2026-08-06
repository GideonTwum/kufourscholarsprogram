"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STAFF_APPLY_NOTICE } from "@/lib/apply-cta";
import { loginPathForRole } from "@/lib/portal-auth";

/**
 * Visible feedback when a signed-in staff member clicks Apply and is bounced home.
 * Without this, /applicant-register → / looks like Apply Now "does nothing".
 */
export default function StaffApplyNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const active = searchParams.get("notice") === STAFF_APPLY_NOTICE;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setRole(profile?.role || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active || dismissed || pathname !== "/") return null;

  const portalLogin = role ? loginPathForRole(role) : "/login";
  const roleLabel =
    role === "director"
      ? "Director"
      : role === "assessor"
        ? "Assessor"
        : role === "panel"
          ? "Panel member"
          : "staff member";

  async function signOutToApply() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/applicant-register");
    router.refresh();
  }

  function dismiss() {
    setDismissed(true);
    router.replace("/");
  }

  return (
    <div
      role="status"
      className="relative z-[60] border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          You&apos;re signed in as a {roleLabel}. Applicant registration is separate — sign out
          to Apply, or open your portal.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={signOutToApply}
            className="rounded-lg bg-royal px-3 py-1.5 text-xs font-semibold text-white hover:bg-royal-light"
          >
            Sign out and Apply
          </button>
          <Link
            href={portalLogin}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-royal hover:bg-amber-100"
          >
            Go to portal
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-800 underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
