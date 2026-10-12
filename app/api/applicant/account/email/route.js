import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { isApplicantRole } from "@/lib/portal-auth";
import { applicantEmailConfirmRedirectTo } from "@/lib/auth-email-confirm";
import { consumeSharedRateLimit } from "@/lib/persistent-rate-limit";
import { APPLICANT_EMAIL_REQUESTED_ACTION } from "@/lib/applicant-profile";
import {
  EMAIL_CHANGE_BOTH_INBOXES_MESSAGE,
  EMAIL_CHANGE_SENT_MESSAGE,
  classifyEmailChangeError,
  redactEmailText,
  validateEmailChangeRequest,
  withTimeout,
} from "@/lib/applicant-email-change";

function logEmailChange(event, extra = {}) {
  console.info("[applicant-email]", { event, ...extra, ts: new Date().toISOString() });
}

export async function POST(request) {
  logEmailChange("request_received");
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logEmailChange("response_returned", { status: 401, code: "session_expired" });
      return NextResponse.json(
        {
          error: "Your session has expired. Sign in again, then request the email change.",
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
      logEmailChange("response_returned", { status: 403, code: "forbidden" });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logEmailChange("authenticated");

    let body;
    try {
      body = await request.json();
    } catch {
      logEmailChange("response_returned", { status: 400, code: "invalid_json" });
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const validation = validateEmailChangeRequest(user.email || profile.email, body?.email);
    if (!validation.ok) {
      logEmailChange("response_returned", { status: validation.status, code: "validation" });
      return NextResponse.json(
        { error: validation.error, field: validation.field, code: "validation" },
        { status: validation.status }
      );
    }

    const limit = await consumeSharedRateLimit(`applicant-email:${user.id}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    logEmailChange("rate_limit_completed", {
      allowed: Boolean(limit.allowed),
      source: limit.source || null,
      unavailable: Boolean(limit.unavailable),
    });
    if (limit.unavailable) {
      logEmailChange("response_returned", { status: 503, code: "rate_limit_unavailable" });
      return NextResponse.json(
        { error: "Email change could not be checked for repeated attempts. Try again shortly.", code: "rate_limit_unavailable" },
        { status: 503 }
      );
    }
    if (!limit.allowed) {
      logEmailChange("response_returned", { status: 429, code: "rate_limited" });
      return NextResponse.json(
        { error: "Too many email change attempts. Try again later.", code: "rate_limited" },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", validation.email)
      .neq("id", user.id)
      .maybeSingle();
    if (existingError) {
      console.error("[applicant-email]", { event: "duplicate_lookup_failed", code: existingError.code || null });
      logEmailChange("response_returned", { status: 500, code: "duplicate_lookup_failed" });
      return NextResponse.json({ error: "The email change could not be started. Try again." }, { status: 500 });
    }
    if (existing) {
      logEmailChange("response_returned", { status: 409, code: "duplicate_email" });
      return NextResponse.json(
        { error: "That email address is already in use.", field: "email", code: "duplicate_email" },
        { status: 409 }
      );
    }

    logEmailChange("auth_update_attempted", { redirect: "site_origin" });
    const raced = await withTimeout(
      supabase.auth.updateUser(
        { email: validation.email },
        { emailRedirectTo: applicantEmailConfirmRedirectTo() }
      ),
      15000
    );
    if (raced.timedOut) {
      logEmailChange("auth_update_received", { ok: false, code: "timeout" });
      logEmailChange("response_returned", { status: 504, code: "timeout" });
      return NextResponse.json(
        { error: "The email service did not respond. Try again in a moment.", code: "timeout" },
        { status: 504 }
      );
    }

    const { error } = raced.value || {};
    logEmailChange("auth_update_received", { ok: !error, code: error?.code || null });
    if (error) {
      console.error("[applicant-email]", {
        event: "auth_update_failed",
        code: error.code || null,
        detail: redactEmailText(error.message),
      });
      const failure = classifyEmailChangeError(error);
      logEmailChange("response_returned", { status: failure.status, code: failure.code });
      return NextResponse.json(
        { error: failure.error, code: failure.code, field: failure.field || null },
        { status: failure.status }
      );
    }

    await recordDirectorAudit({
      actor: { id: user.id, full_name: profile.full_name, email: user.email },
      action: APPLICANT_EMAIL_REQUESTED_ACTION,
      entityType: "profile",
      entityId: user.id,
      oldValue: { email: user.email },
      newValue: { pending_email: validation.email },
      metadata: { actor_type: "applicant", status: "pending_verification" },
      request,
    });

    logEmailChange("response_returned", { status: 200, code: "pending_verification" });
    return NextResponse.json({
      success: true,
      pending: true,
      message: EMAIL_CHANGE_SENT_MESSAGE,
      detail: EMAIL_CHANGE_BOTH_INBOXES_MESSAGE,
    });
  } catch (err) {
    console.error("[applicant-email]", {
      event: "unhandled",
      code: err?.code || null,
      detail: redactEmailText(err?.message),
    });
    return NextResponse.json(
      { error: "The email change could not be started. Try again.", code: "server_error" },
      { status: 500 }
    );
  }
}
