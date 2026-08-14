import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { isDirectorRole } from "@/lib/roles";
import { isProfileActive } from "@/lib/staff-lifecycle";

/**
 * Active director: authenticated + profiles.role=director + is_active.
 * MFA/TOTP/AAL2 is not required in the current Director auth flow.
 */
export async function requireActiveDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json(
        { error: "Forbidden", code: "PROFILE_MISSING" },
        { status: 403 }
      ),
    };
  }

  if (!isDirectorRole(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 }),
    };
  }

  if (!isProfileActive(profile)) {
    return {
      error: NextResponse.json(
        {
          error: "This director account has been deactivated.",
          code: "ACCOUNT_DEACTIVATED",
        },
        { status: 403 }
      ),
    };
  }

  return { user, profile, supabase };
}

/** @deprecated Prefer requireActiveDirector — kept as alias */
export async function requireDirectorUser() {
  return requireActiveDirector();
}

/** Active panel portal user: role=panel AND is_active */
export async function requireActivePanelUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (prof?.role !== "panel" || !isProfileActive(prof)) {
    return {
      error: NextResponse.json(
        { error: "Forbidden", code: prof?.role === "panel" ? "ACCOUNT_DEACTIVATED" : "FORBIDDEN" },
        { status: 403 }
      ),
    };
  }
  return { user, profile: prof, supabase };
}

/** Active assessor portal user: role=assessor AND is_active */
export async function requireActiveAssessor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("role, is_active, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof) {
    return {
      error: NextResponse.json({ error: "Forbidden", code: "PROFILE_MISSING" }, { status: 403 }),
    };
  }

  if (prof.role !== "assessor") {
    return {
      error: NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 }),
    };
  }

  if (!isProfileActive(prof)) {
    return {
      error: NextResponse.json(
        {
          error: "This assessor account has been deactivated.",
          code: "ACCOUNT_DEACTIVATED",
        },
        { status: 403 }
      ),
    };
  }

  return { user, profile: prof, supabase };
}

export async function getAdminOrError() {
  try {
    return { admin: createAdminClient() };
  } catch {
    return { error: NextResponse.json({ error: "Server misconfiguration" }, { status: 500 }) };
  }
}
