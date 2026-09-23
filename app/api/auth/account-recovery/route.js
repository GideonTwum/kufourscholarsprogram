import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/auth-rate-limit";
import { isValidEmailFormat } from "@/lib/auth-recovery";
import {
  ACCOUNT_RECOVERY_RATE_LIMIT,
  evaluateApplicantRecoveryMatch,
  hashEmailForRateLimit,
  initiateMatchedApplicantRecovery,
  logApplicantRecoveryEvent,
  normalizeRecoveryEmail,
  recoveryFailureBody,
  recoveryRateLimitedBody,
  recoverySuccessBody,
  selectRecoveryEmailAction,
} from "@/lib/applicant-account-recovery";

function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Applicant-only account recovery (profiles.role === "applicant").
 *
 * - Matches email + full name + phone against the existing applicant profile and
 *   ALL owned application identity rows (same user_id), not latest-only
 * - Never creates users/profiles/applications
 * - Never returns access/refresh/service-role tokens
 * - Never creates a browser session from the three-field match alone
 * - On match: unverified → verification resend only; verified → password-reset only
 * - Rejects scholar / director / assessor / panel (same generic failure as unknown)
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(recoveryFailureBody());
  }

  const email = normalizeRecoveryEmail(body?.email);
  const fullName = typeof body?.fullName === "string" ? body.fullName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";

  const emailHash = hashEmailForRateLimit(email || "invalid");
  const ip = clientIp(request);

  logApplicantRecoveryEvent("applicant_recovery_requested", { emailHash });

  if (!isValidEmailFormat(email) || !fullName.trim() || !phone.trim()) {
    logApplicantRecoveryEvent("applicant_recovery_match_failed", {
      emailHash,
      code: "invalid_input",
    });
    return NextResponse.json(recoveryFailureBody());
  }

  const limit = consumeRateLimit(`recovery:${emailHash}:${ip}`, ACCOUNT_RECOVERY_RATE_LIMIT);
  if (!limit.allowed) {
    logApplicantRecoveryEvent("applicant_recovery_rate_limited", {
      emailHash,
      code: "rate_limited",
    });
    return NextResponse.json(recoveryRateLimitedBody(limit.retryAfterSec), { status: 429 });
  }

  let profile = null;
  let applications = [];
  let preferredApplicationClassName = null;
  let emailConfirmed = false;

  try {
    const admin = createAdminClient();

    // Initial identity lookup is keyed from profiles.email (not auth.users.email).
    // Prefer exact match on normalized (lowercase) email — registration stores lowercased.
    // Fallback ilike escapes %/_ so wildcards cannot enumerate.
    const ilikeSafe = email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    let { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, email, full_name, phone, role")
      .eq("email", email)
      .limit(5);

    if (!profileError && (!profiles || profiles.length === 0)) {
      ({ data: profiles, error: profileError } = await admin
        .from("profiles")
        .select("id, email, full_name, phone, role")
        .ilike("email", ilikeSafe)
        .limit(5));
    }

    if (profileError) {
      logApplicantRecoveryEvent("applicant_recovery_match_failed", {
        emailHash,
        code: "profile_lookup_error",
        message: profileError.message,
      });
      return NextResponse.json(recoveryFailureBody());
    }

    // Prefer exact normalized email match among ilike hits
    const matches = Array.isArray(profiles)
      ? profiles.filter((p) => normalizeRecoveryEmail(p?.email) === email)
      : [];
    profile = matches.length === 1 ? matches[0] : null;

    if (profile?.id) {
      // All owned application identity rows (not latest-only). Cap is defensive;
      // typical applicants have a small number of rows.
      const { data: apps } = await admin
        .from("applications")
        .select("id, user_id, full_name, phone, application_class_name")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(50);

      applications = Array.isArray(apps) ? apps : [];

      try {
        const { data: classSetting } = await admin
          .from("site_settings")
          .select("value")
          .eq("key", "application_class_name")
          .maybeSingle();
        preferredApplicationClassName =
          typeof classSetting?.value === "string" ? classSetting.value.trim() || null : null;
      } catch {
        preferredApplicationClassName = null;
      }

      try {
        const { data: authData } = await admin.auth.admin.getUserById(profile.id);
        emailConfirmed = Boolean(authData?.user?.email_confirmed_at);
      } catch {
        emailConfirmed = false;
      }
    }
  } catch (err) {
    logApplicantRecoveryEvent("applicant_recovery_match_failed", {
      emailHash,
      code: "admin_unavailable",
      message: err?.message || null,
    });
    return NextResponse.json(recoveryFailureBody());
  }

  const evaluation = evaluateApplicantRecoveryMatch({
    profile,
    applications,
    preferredApplicationClassName,
    email,
    fullName,
    phone,
  });

  const applicationIdPresent = applications.length > 0;

  if (!evaluation.matched) {
    logApplicantRecoveryEvent("applicant_recovery_match_failed", {
      emailHash,
      code: evaluation.code,
      role: profile?.role || null,
      profileIdPresent: Boolean(profile?.id),
      applicationIdPresent,
    });
    return NextResponse.json(recoveryFailureBody());
  }

  logApplicantRecoveryEvent("applicant_recovery_match_succeeded", {
    emailHash,
    code: evaluation.code,
    role: profile.role,
    emailConfirmed,
    profileIdPresent: true,
    applicationIdPresent,
  });

  try {
    const supabase = await createClient();
    await initiateMatchedApplicantRecovery({
      supabase,
      email,
      emailConfirmed,
      originFallback: process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin,
    });
  } catch (err) {
    logApplicantRecoveryEvent("applicant_recovery_match_failed", {
      emailHash,
      code: "recovery_action_error",
      message: err?.message || null,
    });
    // Still return failure — do not claim success if mailer path blew up unexpectedly.
    return NextResponse.json(recoveryFailureBody());
  }

  logApplicantRecoveryEvent("applicant_recovery_completed", {
    emailHash,
    emailConfirmed,
    emailAction: selectRecoveryEmailAction(emailConfirmed),
    profileIdPresent: true,
    applicationIdPresent,
  });

  return NextResponse.json(recoverySuccessBody());
}
