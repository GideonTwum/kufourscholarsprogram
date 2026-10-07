import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import {
  ASSESSOR_ASSIGNABLE_STATUSES,
  buildCurrentAssignmentPayload,
} from "@/lib/assessor-assignment";
import {
  fetchAllApplicationPages,
  fetchAllRowsForIds,
} from "@/lib/director-application-scope";
import { assessmentStageForStatus } from "@/lib/assessor-workflow";

/**
 * Find the active assignee's assessment for the application's CURRENT assessor stage.
 * Stage-1 assessments must not satisfy Stage-2 requirements.
 */
function findCurrentStageAssessment(appId, assessorId, appStatus, assessments) {
  if (!appId || !assessorId) return null;
  const requiredStage = assessmentStageForStatus(appStatus);
  const list = Array.isArray(assessments) ? assessments : [];
  return (
    list.find(
      (row) =>
        row &&
        row.application_id === appId &&
        String(row.assessor_id || "").toLowerCase() === String(assessorId).toLowerCase() &&
        row.stage === requiredStage
    ) || null
  );
}

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const admin = createAdminClient();

  const [{ data: assessors, error: assessorErr }, { data: applications, error: appErr }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, email, full_name, created_at, is_active, deactivated_at")
        .eq("role", "assessor")
        .order("created_at", { ascending: false }),
      fetchAllApplicationPages(() =>
        admin
          .from("applications")
          .select(
            "id, status, full_name, university, student_id, submitted_at, profiles!applications_user_id_fkey(email)"
          )
          .in("status", ASSESSOR_ASSIGNABLE_STATUSES)
          .order("submitted_at", { ascending: false, nullsFirst: false })
      ),
    ]);

  if (assessorErr) {
    console.error("[director-assessors] load assessors failed", {
      code: assessorErr.code || null,
      message: assessorErr.message || String(assessorErr),
    });
    return NextResponse.json({ error: "Could not load assessors." }, { status: 500 });
  }

  if (appErr) {
    console.error("[director-assessors] load applications failed", {
      code: appErr.code || null,
      message: appErr.message || String(appErr),
    });
    return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  }

  const { data: assignmentRows, error: assignErr } = await fetchAllApplicationPages(() =>
    admin
      .from("assessor_assignments")
      .select("id, assessor_id, application_id, status, assigned_at, completed_at")
  );

  if (assignErr) {
    console.error("[director-assessors] load assignments failed", {
      code: assignErr.code || null,
      message: assignErr.message || String(assignErr),
    });
  }

  const assignments = assignmentRows || [];
  const activeAssignments = assignments.filter((row) => row.status === "active");
  const applicationList = applications || [];

  const appIds = [
    ...new Set([
      ...applicationList.map((app) => app.id).filter(Boolean),
      ...activeAssignments.map((row) => row.application_id).filter(Boolean),
    ]),
  ];

  let assessments = [];
  if (appIds.length > 0) {
    const { data: assessmentRows, error: assessErr } = await fetchAllRowsForIds(
      (chunkIds) =>
        admin
          .from("application_assessments")
          .select(
            "id, assessor_id, application_id, stage, recommendation, submitted_at, updated_at"
          )
          .in("application_id", chunkIds)
          .order("submitted_at", { ascending: false }),
      appIds
    );

    if (assessErr) {
      console.error("[director-assessors] load assessments failed", {
        code: assessErr.code || null,
        message: assessErr.message || String(assessErr),
        operation: "application_assessments.select.chunked",
        applicationIdCount: appIds.length,
        activeAssignmentCount: activeAssignments.length,
      });
    } else {
      assessments = assessmentRows || [];
      if (activeAssignments.length > 0 && assessments.length === 0) {
        console.warn("[director-assessors] assessments empty while active assignments exist", {
          activeAssignmentCount: activeAssignments.length,
          applicationIdCount: appIds.length,
        });
      }
    }
  }

  const assessorById = Object.fromEntries((assessors || []).map((a) => [a.id, a]));

  const activeCountByAssessor = {};
  const assignmentCountByAssessor = {};
  const activeByApplication = {};
  for (const row of assignments) {
    if (!row?.assessor_id) continue;
    assignmentCountByAssessor[row.assessor_id] =
      (assignmentCountByAssessor[row.assessor_id] || 0) + 1;
    if (row.status === "active") {
      activeCountByAssessor[row.assessor_id] = (activeCountByAssessor[row.assessor_id] || 0) + 1;
      activeByApplication[row.application_id] = row;
    }
  }

  const assessmentCountByAssessor = {};
  for (const row of assessments) {
    if (!row?.assessor_id) continue;
    assessmentCountByAssessor[row.assessor_id] =
      (assessmentCountByAssessor[row.assessor_id] || 0) + 1;
  }

  const enrichedApplications = applicationList.map((app) => {
    const active = activeByApplication[app.id] || null;
    const assessor = active ? assessorById[active.assessor_id] || null : null;
    const assessment = active
      ? findCurrentStageAssessment(app.id, active.assessor_id, app.status, assessments)
      : null;
    const current_assignment = buildCurrentAssignmentPayload(active, assessor, assessment);

    return {
      id: app.id,
      applicant_name: app.full_name || null,
      email: app.profiles?.email || null,
      university: app.university || null,
      student_id: app.student_id || null,
      status: app.status,
      submitted_at: app.submitted_at || null,
      full_name: app.full_name || null,
      profiles: app.profiles || null,
      current_assignment,
    };
  });

  return NextResponse.json({
    assessors: (assessors || []).map((a) => ({
      id: a.id,
      email: a.email,
      full_name: a.full_name,
      created_at: a.created_at,
      is_active: a.is_active !== false,
      deactivated_at: a.deactivated_at || null,
      active_assignment_count: activeCountByAssessor[a.id] || 0,
      assignment_count: assignmentCountByAssessor[a.id] || 0,
      assessment_count: assessmentCountByAssessor[a.id] || 0,
    })),
    assignments: activeAssignments,
    all_assignments: assignments,
    applications: enrichedApplications,
    unassigned_applications: enrichedApplications.filter((app) => !app.current_assignment),
    assignable_statuses: ASSESSOR_ASSIGNABLE_STATUSES,
  });
}
