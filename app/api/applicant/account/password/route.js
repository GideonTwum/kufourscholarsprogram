import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { isApplicantRole } from "@/lib/portal-auth";
import { passwordsMatch, validatePasswordPolicy } from "@/lib/password-policy";
import { consumeSharedRateLimit } from "@/lib/persistent-rate-limit";
import { APPLICANT_PASSWORD_CHANGED_ACTION } from "@/lib/applicant-profile";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isApplicantRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = await consumeSharedRateLimit(`applicant-password:${user.id}`, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many password attempts. Try again later." }, { status: 429 });
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
  if (typeof currentPassword !== "string" || typeof nextPassword !== "string") {
    return NextResponse.json({ error: "Current and new passwords are required." }, { status: 400 });
  }
  if (!passwordsMatch(nextPassword, confirmPassword)) {
    return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
  }
  const policy = validatePasswordPolicy(nextPassword);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.message }, { status: 400 });
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) {
    return NextResponse.json({ error: "The password could not be updated." }, { status: 400 });
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

  return NextResponse.json({ success: true, message: "Password updated." });
}
