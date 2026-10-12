import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { isApplicantRole } from "@/lib/portal-auth";
import { isValidEmailFormat } from "@/lib/auth-recovery";
import { applicantEmailConfirmRedirectTo } from "@/lib/auth-email-confirm";
import { consumeSharedRateLimit } from "@/lib/persistent-rate-limit";
import { APPLICANT_EMAIL_REQUESTED_ACTION } from "@/lib/applicant-profile";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isApplicantRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = await consumeSharedRateLimit(`applicant-email:${user.id}`, {
    windowMs: 15 * 60 * 1000,
    max: 5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many email change attempts. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (email === String(user.email || "").toLowerCase()) {
    return NextResponse.json({ error: "That is already your email address." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .neq("id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
  }

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: applicantEmailConfirmRedirectTo() }
  );
  if (error) {
    return NextResponse.json({ error: "The email change could not be started." }, { status: 400 });
  }

  await recordDirectorAudit({
    actor: { id: user.id, full_name: profile.full_name, email: user.email },
    action: APPLICANT_EMAIL_REQUESTED_ACTION,
    entityType: "profile",
    entityId: user.id,
    oldValue: { email: user.email },
    newValue: { pending_email: email },
    metadata: { actor_type: "applicant", status: "pending_verification" },
    request,
  });

  return NextResponse.json({
    success: true,
    pending: true,
    message: "Check your inbox to verify the new email address. It will not replace your current email until verification is complete.",
  });
}
