"use client";

/**
 * CURRENTLY UNUSED — Director MFA/TOTP is not part of the active auth flow.
 * Active Directors are redirected to /director; others to /director-login.
 * Enrollment UI is intentionally not shown.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isDirectorRole } from "@/lib/roles";
import { isProfileActive } from "@/lib/staff-lifecycle";

export default function DirectorMfaSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/director-login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (isDirectorRole(profile?.role) && isProfileActive(profile)) {
        router.replace("/director");
        return;
      }

      router.replace("/director-login");
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  return (
    <div className="flex justify-center rounded-2xl bg-white p-12 shadow-xl">
      <Loader2 className="h-8 w-8 animate-spin text-royal" />
    </div>
  );
}
