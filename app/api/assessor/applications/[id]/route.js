import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { validateAssessmentPayload } from "@/lib/assessor-workflow";

async function requireAssessor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "assessor") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

async function requireAssignment(admin, assessorId, applicationId) {
  const { data: assignment } = await admin
    .from("assessor_assignments")
    .select("id")
    .eq("assessor_id", assessorId)
    .eq("application_id", applicationId)
    .eq("status", "active")
    .maybeSingle();
  return assignment;
}

export async function GET(_request, { params }) {
  const gate = await requireAssessor();
  if (gate.error) return gate.error;

  const { id } = await params;
  const admin = createAdminClient();
  const assignment = await requireAssignment(admin, gate.user.id, id);
  if (!assignment) {
    return NextResponse.json({ error: "Not assigned to this application." }, { status: 403 });
  }

  const [{ data: application, error }, { data: assessments }] = await Promise.all([
    admin
      .from("applications")
      .select("*, profiles!applications_user_id_fkey(full_name, email)")
      .eq("id", id)
      .single(),
    admin
      .from("application_assessments")
      .select("*")
      .eq("application_id", id)
      .eq("assessor_id", gate.user.id)
      .order("submitted_at", { ascending: false }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application, assessments: assessments || [] });
}

export async function PATCH(request, { params }) {
  const gate = await requireAssessor();
  if (gate.error) return gate.error;

  const { id } = await params;
  const body = await request.json();
  const admin = createAdminClient();

  const assignment = await requireAssignment(admin, gate.user.id, id);
  if (!assignment) {
    return NextResponse.json({ error: "Not assigned to this application." }, { status: 403 });
  }

  const { data: application, error: appLoadError } = await admin
    .from("applications")
    .select("id, status")
    .eq("id", id)
    .single();

  if (appLoadError || !application) {
    return NextResponse.json({ error: appLoadError?.message || "Application not found." }, { status: 404 });
  }

  const validation = validateAssessmentPayload(body, application.status);
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { error: assessmentError } = await admin.from("application_assessments").upsert(
    {
      application_id: id,
      assessor_id: gate.user.id,
      stage: validation.stage,
      ...validation.assessment,
      updated_at: nowIso,
    },
    { onConflict: "application_id,assessor_id,stage" },
  );

  if (assessmentError) {
    return NextResponse.json({ error: assessmentError.message }, { status: 500 });
  }

  const updatePayload = {
    status: validation.nextStatus,
    updated_at: nowIso,
  };
  if (validation.nextStatus === "stage_1_approved") updatePayload.stage_1_approved_at = nowIso;
  if (validation.nextStatus === "stage_2_approved") updatePayload.stage_2_approved_at = nowIso;
  if (validation.nextStatus !== "rejected") updatePayload.rejection_reason = null;

  const { error: updateError } = await admin
    .from("applications")
    .update(updatePayload)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (["rejected", "interview_review_pending"].includes(validation.nextStatus)) {
    await admin
      .from("assessor_assignments")
      .update({ status: "completed", completed_at: nowIso })
      .eq("id", assignment.id);
  }

  return NextResponse.json({
    success: true,
    status: validation.nextStatus,
    stage: validation.stage,
    overall_score: validation.assessment.overall_score,
  });
}
