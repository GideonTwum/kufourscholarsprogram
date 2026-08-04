import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { isProfileActive } from "@/lib/staff-lifecycle";
import { sendKspEmail } from "@/lib/email/send";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

async function loadActiveAssessor(admin, assessorId) {
  const { data: assessor } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", assessorId)
    .eq("role", "assessor")
    .maybeSingle();
  return assessor;
}

/**
 * Assign applications to an active assessor.
 * Launch model: one active assessor per application.
 * Existing active assignments for those apps are marked reassigned.
 */
export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assessorId = body?.assessor_id;
  const applicationIds = Array.isArray(body?.application_ids)
    ? [...new Set(body.application_ids.filter(Boolean))]
    : [];

  if (!assessorId || applicationIds.length === 0) {
    return NextResponse.json(
      { error: "assessor_id and at least one application_id are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const assessor = await loadActiveAssessor(admin, assessorId);

  if (!assessor) {
    return NextResponse.json({ error: "Assessor not found." }, { status: 404 });
  }
  if (!isProfileActive(assessor)) {
    return NextResponse.json(
      { error: "Cannot assign applicants to an inactive assessor. Reactivate the account first." },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();

  const { error: closeErr } = await admin
    .from("assessor_assignments")
    .update({ status: "reassigned", completed_at: nowIso })
    .in("application_id", applicationIds)
    .eq("status", "active")
    .neq("assessor_id", assessorId);

  if (closeErr) {
    return NextResponse.json({ error: "Failed to clear prior assignments" }, { status: 500 });
  }

  const rows = applicationIds.map((applicationId) => ({
    assessor_id: assessorId,
    application_id: applicationId,
    assigned_by: gate.user.id,
    status: "active",
    assigned_at: nowIso,
    completed_at: null,
  }));

  const { error } = await admin
    .from("assessor_assignments")
    .upsert(rows, { onConflict: "application_id,assessor_id" });

  if (error) {
    return NextResponse.json({ error: "Assignment failed" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "assessor.assigned",
    entityType: "assessor_assignment",
    entityId: assessorId,
    newValue: { assessor_id: assessorId, application_ids: applicationIds },
    request,
  });

  if (assessor.email) {
    await sendKspEmail({
      event: "assessor_assignment",
      to: assessor.email,
      subject: "New applicants assigned — Kufuor Scholars",
      html: `<p>You have been assigned <strong>${applicationIds.length}</strong> applicant(s) for review. Sign in at <a href="/assessor-login">/assessor-login</a> to submit recommendations.</p>`,
      text: `You have been assigned ${applicationIds.length} applicant(s) for review. Sign in at /assessor-login.`,
      template: "assessor_assignment",
      directorId: gate.user.id,
    });
  }

  return NextResponse.json({ success: true, assigned: rows.length });
}

/**
 * PATCH { action: "unassign"|"reassign", application_id, assessor_id? }
 */
export async function PATCH(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body?.action;
  const applicationId = body?.application_id;
  if (!applicationId || (action !== "unassign" && action !== "reassign")) {
    return NextResponse.json(
      { error: "action (unassign|reassign) and application_id are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (action === "unassign") {
    const { data: current } = await admin
      .from("assessor_assignments")
      .select("id, assessor_id")
      .eq("application_id", applicationId)
      .eq("status", "active")
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: "No active assignment for this application." }, { status: 404 });
    }

    const { error } = await admin
      .from("assessor_assignments")
      .update({ status: "completed", completed_at: nowIso })
      .eq("id", current.id);

    if (error) {
      return NextResponse.json({ error: "Failed to unassign" }, { status: 500 });
    }

    await recordDirectorAudit({
      actor: gate.profile,
      action: "assessor.unassigned",
      entityType: "application",
      entityId: applicationId,
      oldValue: { assessor_id: current.assessor_id },
      request,
    });

    return NextResponse.json({
      success: true,
      action: "unassign",
      message: "Assessor unassigned. Assessment history is preserved.",
    });
  }

  const newAssessorId = body?.assessor_id;
  if (!newAssessorId) {
    return NextResponse.json({ error: "assessor_id is required for reassignment." }, { status: 400 });
  }

  const assessor = await loadActiveAssessor(admin, newAssessorId);
  if (!assessor) {
    return NextResponse.json({ error: "Assessor not found." }, { status: 404 });
  }
  if (!isProfileActive(assessor)) {
    return NextResponse.json(
      { error: "Cannot reassign to an inactive assessor." },
      { status: 409 }
    );
  }

  const { data: prior } = await admin
    .from("assessor_assignments")
    .select("assessor_id")
    .eq("application_id", applicationId)
    .eq("status", "active")
    .maybeSingle();

  await admin
    .from("assessor_assignments")
    .update({ status: "reassigned", completed_at: nowIso })
    .eq("application_id", applicationId)
    .eq("status", "active");

  const { error: upsertErr } = await admin.from("assessor_assignments").upsert(
    {
      assessor_id: newAssessorId,
      application_id: applicationId,
      assigned_by: gate.user.id,
      status: "active",
      assigned_at: nowIso,
      completed_at: null,
    },
    { onConflict: "application_id,assessor_id" }
  );

  if (upsertErr) {
    return NextResponse.json({ error: "Failed to reassign" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "assessor.reassigned",
    entityType: "application",
    entityId: applicationId,
    oldValue: { assessor_id: prior?.assessor_id || null },
    newValue: { assessor_id: newAssessorId },
    request,
  });

  if (assessor.email) {
    await sendKspEmail({
      event: "assessor_reassignment",
      to: assessor.email,
      subject: "Applicant reassigned to you — Kufuor Scholars",
      html: `<p>An applicant has been reassigned to you for review. Sign in at <a href="/assessor-login">/assessor-login</a>.</p>`,
      text: `An applicant has been reassigned to you for review. Sign in at /assessor-login.`,
      template: "assessor_reassignment",
      directorId: gate.user.id,
    });
  }

  return NextResponse.json({
    success: true,
    action: "reassign",
    message: "Application reassigned. Prior assignment history and assessments are preserved.",
  });
}
