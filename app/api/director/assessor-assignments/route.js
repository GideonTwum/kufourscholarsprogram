import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { isProfileActive } from "@/lib/staff-lifecycle";
import { sendKspEmail } from "@/lib/email/send";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import {
  ASSESSOR_ASSIGNABLE_STATUSES,
  isAssessorAssignableStatus,
  isUuid,
  normalizeAssignmentApplicationIds,
  resolveReassignAssessorId,
} from "@/lib/assessor-assignment";

async function loadAssessor(admin, assessorId) {
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", assessorId)
    .eq("role", "assessor")
    .maybeSingle();
  return data;
}

async function loadActiveAssignment(admin, applicationId) {
  const { data } = await admin
    .from("assessor_assignments")
    .select("id, assessor_id, status, assigned_at, profiles:assessor_id(id, full_name, email, is_active)")
    .eq("application_id", applicationId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

/**
 * POST — assign application(s) to an active assessor.
 *
 * Body:
 *   { assessor_id, application_id } OR { assessor_id, application_ids: [] }
 *   force_reassign?: boolean  — if true, close other active assignees (bulk UI)
 *
 * Does NOT change applications.status.
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

  const assessorId = typeof body?.assessor_id === "string" ? body.assessor_id.trim() : "";
  const applicationIds = normalizeAssignmentApplicationIds(body);
  const forceReassign = body?.force_reassign === true;

  if (!isUuid(assessorId) || applicationIds.length === 0 || !applicationIds.every(isUuid)) {
    return NextResponse.json(
      {
        error:
          "assessor_id and application_id (or application_ids) are required and must be valid UUIDs.",
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const assessor = await loadAssessor(admin, assessorId);

  if (!assessor) {
    return NextResponse.json({ error: "Assessor not found." }, { status: 404 });
  }
  if (!isProfileActive(assessor)) {
    return NextResponse.json(
      {
        error: "Cannot assign applicants to an inactive assessor. Reactivate the account first.",
        code: "INACTIVE_ASSESSOR",
      },
      { status: 409 }
    );
  }

  const { data: apps, error: appsErr } = await admin
    .from("applications")
    .select("id, status, full_name")
    .in("id", applicationIds);

  if (appsErr) {
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }

  const appsById = Object.fromEntries((apps || []).map((a) => [a.id, a]));
  const missing = applicationIds.filter((id) => !appsById[id]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Application not found.", code: "APPLICATION_NOT_FOUND", missing },
      { status: 404 }
    );
  }

  const ineligible = applicationIds.filter((id) => !isAssessorAssignableStatus(appsById[id].status));
  if (ineligible.length > 0) {
    return NextResponse.json(
      {
        error: `Application status is not eligible for assessor assignment. Allowed: ${ASSESSOR_ASSIGNABLE_STATUSES.join(", ")}.`,
        code: "STATUS_NOT_ASSIGNABLE",
        application_ids: ineligible,
      },
      { status: 409 }
    );
  }

  // Single-app: require explicit reassign when another assessor is active
  if (applicationIds.length === 1 && !forceReassign) {
    const current = await loadActiveAssignment(admin, applicationIds[0]);
    if (current && current.assessor_id !== assessorId) {
      return NextResponse.json(
        {
          error: "This application already has an active assessor. Use Reassign.",
          code: "REASSIGN_REQUIRED",
          current_assessor_id: current.assessor_id,
          current_assessor:
            current.profiles ||
            null,
        },
        { status: 409 }
      );
    }
    if (current && current.assessor_id === assessorId) {
      return NextResponse.json({
        success: true,
        assigned: 1,
        idempotent: true,
        message: "Application is already assigned to this assessor.",
        assignment: {
          id: current.id,
          application_id: applicationIds[0],
          assessor_id: assessorId,
          status: "active",
          assigned_at: current.assigned_at,
        },
        application_status_unchanged: true,
      });
    }
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

  const { data: upserted, error } = await admin
    .from("assessor_assignments")
    .upsert(rows, { onConflict: "application_id,assessor_id" })
    .select("id, assessor_id, application_id, status, assigned_at");

  if (error) {
    const msg = error.message || "";
    if (/assessor_assignments_one_active|unique/i.test(msg)) {
      return NextResponse.json(
        {
          error: "Another active assignment already exists for this application. Use Reassign.",
          code: "REASSIGN_REQUIRED",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Assignment failed" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "assessor.assignment_created",
    entityType: "assessor_assignment",
    entityId: applicationIds.length === 1 ? applicationIds[0] : assessorId,
    newValue: {
      assessor_id: assessorId,
      assessor_email: assessor.email,
      assessor_name: assessor.full_name,
      application_ids: applicationIds,
      force_reassign: forceReassign,
    },
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

  return NextResponse.json({
    success: true,
    assigned: rows.length,
    assignments: upserted || rows,
    message: "Application assigned successfully.",
    application_status_unchanged: true,
  });
}

/**
 * PATCH { action: "unassign"|"reassign", application_id, assessor_id? | new_assessor_id? }
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
  const applicationId = typeof body?.application_id === "string" ? body.application_id.trim() : "";
  if (!isUuid(applicationId) || (action !== "unassign" && action !== "reassign")) {
    return NextResponse.json(
      { error: "action (unassign|reassign) and a valid application_id are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: app } = await admin.from("applications").select("id, status").eq("id", applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

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
      action: "assessor.assignment_unassigned",
      entityType: "application",
      entityId: applicationId,
      oldValue: { assessor_id: current.assessor_id },
      request,
    });

    return NextResponse.json({
      success: true,
      action: "unassign",
      message: "Assessor unassigned. Assessment history is preserved.",
      application_status_unchanged: true,
    });
  }

  const newAssessorId = resolveReassignAssessorId(body);
  if (!isUuid(newAssessorId)) {
    return NextResponse.json(
      { error: "new_assessor_id (or assessor_id) is required for reassignment." },
      { status: 400 }
    );
  }

  const assessor = await loadAssessor(admin, newAssessorId);
  if (!assessor) {
    return NextResponse.json({ error: "Assessor not found." }, { status: 404 });
  }
  if (!isProfileActive(assessor)) {
    return NextResponse.json(
      { error: "Cannot reassign to an inactive assessor.", code: "INACTIVE_ASSESSOR" },
      { status: 409 }
    );
  }

  if (!isAssessorAssignableStatus(app.status)) {
    return NextResponse.json(
      {
        error: `Application status is not eligible for assessor assignment. Allowed: ${ASSESSOR_ASSIGNABLE_STATUSES.join(", ")}.`,
        code: "STATUS_NOT_ASSIGNABLE",
      },
      { status: 409 }
    );
  }

  const { data: prior } = await admin
    .from("assessor_assignments")
    .select("id, assessor_id")
    .eq("application_id", applicationId)
    .eq("status", "active")
    .maybeSingle();

  if (prior?.assessor_id === newAssessorId) {
    return NextResponse.json({
      success: true,
      action: "reassign",
      idempotent: true,
      message: "Application is already assigned to this assessor.",
      application_status_unchanged: true,
    });
  }

  await admin
    .from("assessor_assignments")
    .update({ status: "reassigned", completed_at: nowIso })
    .eq("application_id", applicationId)
    .eq("status", "active");

  const { data: created, error: upsertErr } = await admin
    .from("assessor_assignments")
    .upsert(
      {
        assessor_id: newAssessorId,
        application_id: applicationId,
        assigned_by: gate.user.id,
        status: "active",
        assigned_at: nowIso,
        completed_at: null,
      },
      { onConflict: "application_id,assessor_id" }
    )
    .select("id, assessor_id, application_id, status, assigned_at")
    .maybeSingle();

  if (upsertErr) {
    return NextResponse.json({ error: "Failed to reassign" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "assessor.assignment_reassigned",
    entityType: "application",
    entityId: applicationId,
    oldValue: { assessor_id: prior?.assessor_id || null },
    newValue: {
      assessor_id: newAssessorId,
      assessor_email: assessor.email,
      assessor_name: assessor.full_name,
    },
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
    assignment: created,
    message: "Application reassigned. Prior assignment history and assessments are preserved.",
    application_status_unchanged: true,
  });
}
