import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { isApplicantRole } from "@/lib/portal-auth";
import { classifyPasswordChangeError, validatePasswordChange } from "@/lib/password-policy";
import { consumeSharedRateLimit } from "@/lib/persistent-rate-limit";
import { APPLICANT_PASSWORD_CHANGED_ACTION } from "@/lib/applicant-profile";

/**
 * Check the current password on a client that does not read or write cookies,
 * so the applicant's active session is not replaced.
 */
function createPasswordVerifier() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json(
      {
        error: "Your session has expired. Sign in again to update your password.",
        code: "session_expired",
      },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isApplicantRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const currentPassword = body?.currentPassword;
  const nextPassword = body?.newPassword;
  const confirmPassword = body?.confirmPassword;
  const validation = validatePasswordChange({ currentPassword, newPassword: nextPassword, confirmPassword });
  if (!validation.ok) {
    const field = Object.keys(validation.fields)[0];
    return NextResponse.json(
      { error: validation.fields[field], field, code: "validation" },
      { status: 400 }
    );
  }

  const limit = await consumeSharedRateLimit(`applicant-password:${user.id}`, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many password attempts. Try again later." }, { status: 429 });
  }

  const verifier = createPasswordVerifier();
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    const failure = classifyPasswordChangeError(signInError, "verify");
    return NextResponse.json(
      { error: failure.error, code: failure.code, field: failure.field || null },
      { status: failure.status }
    );
  }

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) {
    const failure = classifyPasswordChangeError(error, "update");
    return NextResponse.json(
      { error: failure.error, code: failure.code, field: failure.field || null },
      { status: failure.status }
    );
  }

  await recordDirectorAudit({
    actor: { id: user.id, full_name: profile.full_name, email: profile.email },
    action: APPLICANT_PASSWORD_CHANGED_ACTION,
    entityType: "profile",
    entityId: user.id,
    oldValue: { password_changed: false },
    newValue: { password_changed: true },
    metadata: { actor_type: "applicant" },
    request,
  });

  return NextResponse.json({
    success: true,
    reauthRequired: false,
    message: "Password updated successfully.",
  });
}
