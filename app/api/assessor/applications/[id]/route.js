import { requireActiveAssessor, getAdminOrError } from "@/lib/director-auth";
import { NextResponse } from "next/server";
import {
  ASSESSOR_APPLICATION_SELECT,
  pickAssessorSafeApplication,
  validateAssessmentPayload,
} from "@/lib/assessor-workflow";
import { sendKspEmail } from "@/lib/email/send";

async function requireAssignment(admin, assessorId, applicationId) {
  const { data: assignment } = await admin
    .from("assessor_assignments")
    .select("id, status")
    .eq("assessor_id", assessorId)
    .eq("application_id", applicationId)
    .eq("status", "active")
    .maybeSingle();
  return assignment;
}

export async function GET(_request, { params }) {
  const gate = await requireActiveAssessor();
  if (gate.error) return gate.error;

  const { id } = await params;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const assignment = await requireAssignment(admin, gate.user.id, id);
  if (!assignment) {
    return NextResponse.json({ error: "Not assigned to this application." }, { status: 403 });
  }

  const [{ data: application, error }, { data: assessments }] = await Promise.all([
    admin
      .from("applications")
      .select(`${ASSESSOR_APPLICATION_SELECT}, profiles!applications_user_id_fkey(full_name, email)`)
      .eq("id", id)
      .single(),
    admin
      .from("application_assessments")
      .select(
        "id, application_id, assessor_id, stage, academic_score, leadership_score, service_score, communication_score, overall_score, recommendation, notes, submitted_at, updated_at"
      )
      .eq("application_id", id)
      .eq("assessor_id", gate.user.id)
      .order("submitted_at", { ascending: false }),
  ]);

  if (error || !application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  return NextResponse.json({
    application: pickAssessorSafeApplication(application),
    assessments: assessments || [],
    assignment: { id: assignment.id, status: assignment.status },
  });
}

/**
 * Submit or update assessment recommendation only.
 * Does NOT mutate applications.status (Director decides).
 */
export async function PATCH(request, { params }) {
  const gate = await requireActiveAssessor();
  if (gate.error) return gate.error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const assignment = await requireAssignment(admin, gate.user.id, id);
  if (!assignment) {
    return NextResponse.json({ error: "Not assigned to this application." }, { status: 403 });
  }

  const { data: application, error: appLoadError } = await admin
    .from("applications")
    .select("id, status, full_name")
    .eq("id", id)
    .single();

  if (appLoadError || !application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const validation = validateAssessmentPayload(body, application.status);
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Hard blocks — assessors never set official status via this API
  if (body?.status === "accepted" || body?.status === "rejected" || body?.apply_status === true) {
    return NextResponse.json(
      {
        error:
          "Assessors submit recommendations only. Official application status is updated by the Director.",
      },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: assessmentError } = await admin.from("application_assessments").upsert(
    {
      application_id: id,
      assessor_id: gate.user.id,
      stage: validation.stage,
      ...validation.assessment,
      updated_at: nowIso,
      submitted_at: nowIso,
    },
    { onConflict: "application_id,assessor_id,stage" }
  );

  if (assessmentError) {
    return NextResponse.json({ error: "Failed to save assessment" }, { status: 500 });
  }

  // Notify assessor (confirmation) and directors — non-blocking
  const applicantLabel = application.full_name || "an applicant";
  const recLabel = validation.assessment.recommendation.replace(/_/g, " ");

  if (gate.profile?.email) {
    await sendKspEmail({
      event: "assessor_assessment_submitted",
      to: gate.profile.email,
      subject: `Assessment saved — ${applicantLabel}`,
      html: `<p>Your recommendation (<strong>${recLabel}</strong>) for <strong>${applicantLabel}</strong> was saved. The Director will review and update the official application status.</p>`,
      text: `Your recommendation (${recLabel}) for ${applicantLabel} was saved. The Director will review and update the official application status.`,
      template: "assessor_assessment_submitted",
    });
  }

  const { data: directors } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "director")
    .eq("is_active", true);

  const directorEmails = [...new Set((directors || []).map((d) => d.email).filter(Boolean))];
  if (directorEmails.length > 0) {
    await sendKspEmail({
      event: "director_assessor_assessment_ready",
      to: directorEmails,
      subject: `Assessor recommendation ready — ${applicantLabel}`,
      html: `<p>An assessor submitted a recommendation (<strong>${recLabel}</strong>) for <strong>${applicantLabel}</strong>. Official status was not changed. Please review and take action in the Director portal.</p>`,
      text: `An assessor submitted a recommendation (${recLabel}) for ${applicantLabel}. Official status was not changed. Please review in the Director portal.`,
      template: "director_assessor_assessment_ready",
    });
  }

  return NextResponse.json({
    success: true,
    status_unchanged: true,
    application_status: application.status,
    stage: validation.stage,
    recommendation: validation.assessment.recommendation,
    suggested_status: validation.suggestedStatus,
    overall_score: validation.assessment.overall_score,
    message:
      "Recommendation saved. Official application status was not changed. The Director will review and decide.",
  });
}
