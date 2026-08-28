import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { evaluateEligibilityForAutoReject } from "@/lib/eligibility-server";
import { autoRejectEmailHtml, stage1SubmittedEmailHtml } from "@/lib/email/notify";
import { sendKspEmail } from "@/lib/email/send";
import { sanitizeStage1ApplicationData } from "@/lib/stage1-application-payload";
import { assertStatusTransition } from "@/lib/application-status-transition.mjs";
import {
  normalizeDualCitizenshipFields,
  normalizeConceptNoteTitle,
  validateForSubmit,
  getRecommendationLetterPaths,
  getLeadershipEvidencePaths,
} from "@/lib/application-validation";
import { normalizeYearOfStudy } from "@/lib/countries";
import { assertOwnedApplicationsPath } from "@/lib/storage-path";
import {
  evaluateApplicationsOpenGate,
  supabaseProjectHostFromUrl,
} from "@/lib/applications-open-gate";

export const dynamic = "force-dynamic";

const APPLICANT_SAVE_ERROR =
  "We couldn't save your application. Please try again. If the problem continues, contact KSP support.";

function buildRow(applicationData, userId, overrides = {}) {
  const leadership = Array.isArray(applicationData.leadership_evidence_urls)
    ? applicationData.leadership_evidence_urls.filter((x) => typeof x === "string" && x)
    : [];
  const recommendations = getRecommendationLetterPaths(applicationData);
  return {
    ...applicationData,
    user_id: userId,
    leadership_evidence_urls: leadership,
    leadership_evidence_url: leadership[0] || null,
    recommendation_urls: recommendations,
    recommendation_url: recommendations[0] || null,
    concept_note_title: normalizeConceptNoteTitle(applicationData.concept_note_title) || null,
    concept_note_path:
      typeof applicationData.concept_note_path === "string"
        ? applicationData.concept_note_path.trim() || null
        : null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Ensure private document paths belong to this applicant (IDOR / fake-path guard). */
function validateOwnedDocumentPaths(data, userId) {
  const errors = {};
  const checks = [
    ["academic_transcript_url", "Academic Transcript"],
    ["cv_personal_statement_url", "CV / Personal Statement"],
    ["student_id_path", "National ID"],
    ["concept_note_path", "Concept Note"],
    ["ksp_tiktok_follow_screenshot_path", "TikTok follow screenshot"],
    ["ksp_linkedin_follow_screenshot_path", "LinkedIn follow screenshot"],
    ["ksp_instagram_follow_screenshot_path", "Instagram follow screenshot"],
  ];
  // Passport Picture is stored as a public avatars URL (not applications path).
  if (!data.photo_url?.trim()) {
    errors.photo_url = "Passport Picture is required";
  }
  for (const [field, label] of checks) {
    const err = assertOwnedApplicationsPath(data[field], userId, label);
    if (err) errors[field] = err;
  }
  getRecommendationLetterPaths(data).forEach((path, i) => {
    const err = assertOwnedApplicationsPath(path, userId, `Recommendation Letter ${i + 1}`);
    if (err) errors.recommendation_urls = err;
  });
  getLeadershipEvidencePaths(data).forEach((path, i) => {
    const err = assertOwnedApplicationsPath(path, userId, `Leadership evidence ${i + 1}`);
    if (err) errors.leadership_evidence_urls = err;
  });
  return errors;
}

async function assertApplicationsOpen(admin) {
  const serverNowMs = Date.now();
  const serverNowIso = new Date(serverNowMs).toISOString();
  const supabaseProjectHost = supabaseProjectHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const { data: openSetting, error: openError } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "applications_open")
    .maybeSingle();

  const { data: deadlineSetting, error: deadlineError } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "application_deadline")
    .maybeSingle();

  const applicationsOpen = openSetting?.value ?? null;
  const deadlineRaw = deadlineSetting?.value ?? null;
  const gate = evaluateApplicationsOpenGate({
    applicationsOpen,
    deadlineRaw,
    nowMs: serverNowMs,
  });

  // Temporary production incident diagnostics — no PII / tokens / secrets.
  console.info("[stage1-deadline-diagnostic]", {
    applicationsOpen,
    deadlineRaw,
    deadlineParsedIso: gate.deadlineParsedIso,
    deadlineMs: gate.deadlineMs,
    serverNowIso,
    serverNowMs,
    isExpired: gate.isExpired,
    allowed: gate.allowed,
    reason: gate.reason,
    openQueryError: openError?.code || openError?.message || null,
    deadlineQueryError: deadlineError?.code || deadlineError?.message || null,
    supabaseProjectHost,
    requestStage: "submit-stage1",
  });

  return gate.reason;
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before submitting your application." },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { application_id, data: applicationData } = body;
  if (!applicationData) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const { data: safeApplicationData, ignoredDangerousFields } =
    sanitizeStage1ApplicationData(applicationData);

  const normalized = normalizeDualCitizenshipFields({
    ...safeApplicationData,
    year_of_study: normalizeYearOfStudy(safeApplicationData.year_of_study) || safeApplicationData.year_of_study,
    concept_note_title: normalizeConceptNoteTitle(safeApplicationData.concept_note_title),
    concept_note_path:
      typeof safeApplicationData.concept_note_path === "string"
        ? safeApplicationData.concept_note_path.trim()
        : "",
  });

  if (ignoredDangerousFields.length > 0) {
    console.warn("[submit-stage1] ignored protected applicant fields", {
      userId: user.id,
      fields: ignoredDangerousFields,
    });
  }

  const submitErrors = validateForSubmit(normalized);
  if (Object.keys(submitErrors).length > 0) {
    const first = Object.values(submitErrors)[0];
    return NextResponse.json(
      { error: first || "Application is incomplete.", field_errors: submitErrors },
      { status: 400 }
    );
  }

  const ownershipErrors = validateOwnedDocumentPaths(normalized, user.id);
  if (Object.keys(ownershipErrors).length > 0) {
    const first = Object.values(ownershipErrors)[0];
    return NextResponse.json(
      { error: first || "One or more documents are invalid.", field_errors: ownershipErrors },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error. Please contact KSP support." },
      { status: 500 }
    );
  }

  const closedMsg = await assertApplicationsOpen(admin);
  if (closedMsg) {
    return NextResponse.json({ error: closedMsg }, { status: 403 });
  }

  const eligibility = evaluateEligibilityForAutoReject(normalized);
  const submitted_at = new Date().toISOString();

  let appId = application_id || null;

  if (appId) {
    const { data: existing } = await admin
      .from("applications")
      .select("id, user_id, status")
      .eq("id", appId)
      .single();
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status !== "draft") {
      return NextResponse.json({ error: "Application already submitted" }, { status: 400 });
    }
    const target = eligibility.ok ? "stage_1_submitted" : "rejected";
    const transitionError = assertStatusTransition(existing.status, target);
    if (transitionError) {
      return NextResponse.json({ error: transitionError }, { status: 409 });
    }
  } else {
    // Prefer updating an existing draft over creating a duplicate application row
    const { data: existingDraft } = await admin
      .from("applications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingDraft?.id) {
      appId = existingDraft.id;
    } else {
      const { data: anyNonDraft } = await admin
        .from("applications")
        .select("id, status")
        .eq("user_id", user.id)
        .neq("status", "draft")
        .limit(1)
        .maybeSingle();
      if (anyNonDraft?.id) {
        return NextResponse.json({ error: "Application already submitted" }, { status: 400 });
      }
    }
  }

  const userEmail = user.email || null;

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const profileName = normalized.full_name || prof?.full_name || "Applicant";

  if (!eligibility.ok) {
    const row = buildRow(normalized, user.id, {
      status: "rejected",
      rejection_reason: eligibility.reason,
      submitted_at,
    });
    if (appId) {
      const { error: updErr } = await admin.from("applications").update(row).eq("id", appId);
      if (updErr) {
        console.error("[submit-stage1] reject update failed", updErr.message);
        return NextResponse.json({ error: APPLICANT_SAVE_ERROR }, { status: 500 });
      }
    } else {
      const { data: ins, error: insErr } = await admin.from("applications").insert(row).select("id").single();
      if (insErr) {
        console.error("[submit-stage1] reject insert failed", insErr.message);
        return NextResponse.json({ error: APPLICANT_SAVE_ERROR }, { status: 500 });
      }
      appId = ins?.id;
    }
    if (userEmail) {
      await sendKspEmail({
        event: "stage_1_auto_rejected",
        to: userEmail,
        subject: "Kufuor Scholars Program — application update",
        html: autoRejectEmailHtml(profileName || "Applicant", eligibility.reason),
        text: `Your application could not proceed. ${eligibility.reason}`,
        template: "rejected",
        meta: { applicantName: profileName || "Applicant", reason: eligibility.reason },
      });
    }
    return NextResponse.json({
      success: true,
      outcome: "rejected",
      rejection_reason: eligibility.reason,
      application_id: appId,
    });
  }

  const row = buildRow(normalized, user.id, {
    status: "stage_1_submitted",
    rejection_reason: null,
    submitted_at,
    stage_1_submitted_at: submitted_at,
  });

  if (appId) {
    const { error: updErr } = await admin.from("applications").update(row).eq("id", appId);
    if (updErr) {
      console.error("[submit-stage1] submit update failed", updErr.message);
      return NextResponse.json({ error: APPLICANT_SAVE_ERROR }, { status: 500 });
    }
  } else {
    const { data: ins, error: insErr } = await admin.from("applications").insert(row).select("id").single();
    if (insErr) {
      console.error("[submit-stage1] submit insert failed", insErr.message);
      return NextResponse.json({ error: APPLICANT_SAVE_ERROR }, { status: 500 });
    }
    appId = ins?.id;
  }

  let persistedClass = null;
  if (appId) {
    const { data: stamped } = await admin
      .from("applications")
      .select("application_class_name")
      .eq("id", appId)
      .maybeSingle();
    persistedClass = stamped?.application_class_name || null;
  }

  if (userEmail) {
    await sendKspEmail({
      event: "stage_1_submitted",
      to: userEmail,
      subject: "Kufuor Scholars — Stage 1 application received",
      html: stage1SubmittedEmailHtml(profileName || "Applicant", persistedClass),
      text: persistedClass
        ? `Your Stage 1 application to the Kufuor Scholars Program ${persistedClass} was received and is pending review.`
        : "Your Stage 1 application was received and is pending review.",
      template: "stage1_submitted",
      meta: { applicantName: profileName || "Applicant", applicationClassName: persistedClass },
    });
  }

  return NextResponse.json({
    success: true,
    outcome: "pending",
    application_id: appId,
  });
}
