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
} from "@/lib/application-validation";
import { normalizeYearOfStudy } from "@/lib/countries";

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

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const eligibility = evaluateEligibilityForAutoReject(normalized);
  const submitted_at = new Date().toISOString();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error (missing service role)." },
      { status: 500 }
    );
  }

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
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    } else {
      const { data: ins, error: insErr } = await admin.from("applications").insert(row).select("id").single();
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
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
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    const { data: ins, error: insErr } = await admin.from("applications").insert(row).select("id").single();
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    appId = ins?.id;
  }

  if (userEmail) {
    await sendKspEmail({
      event: "stage_1_submitted",
      to: userEmail,
      subject: "Kufuor Scholars — Stage 1 application received",
      html: stage1SubmittedEmailHtml(profileName || "Applicant"),
      text: "Your Stage 1 application was received and is pending review.",
      template: "stage1_submitted",
      meta: { applicantName: profileName || "Applicant" },
    });
  }

  return NextResponse.json({
    success: true,
    outcome: "pending",
    application_id: appId,
  });
}
