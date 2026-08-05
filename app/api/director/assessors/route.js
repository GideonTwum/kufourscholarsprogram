import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import {
  ASSESSOR_ASSIGNABLE_STATUSES,
  buildCurrentAssignmentPayload,
} from "@/lib/assessor-assignment";

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const admin = createAdminClient();

  const [{ data: assessors }, { data: assignments }, { data: applications }, { data: assessments }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, email, full_name, created_at, is_active, deactivated_at")
        .eq("role", "assessor")
        .order("created_at", { ascending: false }),
      admin
        .from("assessor_assignments")
        .select("id, assessor_id, application_id, status, assigned_at, completed_at"),
      admin
        .from("applications")
        .select("id, status, full_name, university, submitted_at, profiles!applications_user_id_fkey(email)")
        .in("status", ASSESSOR_ASSIGNABLE_STATUSES)
        .order("submitted_at", { ascending: false })
        .limit(500),
      admin
        .from("application_assessments")
        .select("id, assessor_id, application_id, recommendation, submitted_at, updated_at"),
    ]);

  const assessorById = Object.fromEntries((assessors || []).map((a) => [a.id, a]));

  const activeCountByAssessor = {};
  const assignmentCountByAssessor = {};
  const activeByApplication = {};
  (assignments || []).forEach((row) => {
    assignmentCountByAssessor[row.assessor_id] =
      (assignmentCountByAssessor[row.assessor_id] || 0) + 1;
    if (row.status === "active") {
      activeCountByAssessor[row.assessor_id] = (activeCountByAssessor[row.assessor_id] || 0) + 1;
      activeByApplication[row.application_id] = row;
    }
  });

  const assessmentCountByAssessor = {};
  /** Latest assessment per application+assessor (by submitted_at). */
  const assessmentByAppAssessor = {};
  (assessments || []).forEach((row) => {
    if (!row.assessor_id) return;
    assessmentCountByAssessor[row.assessor_id] =
      (assessmentCountByAssessor[row.assessor_id] || 0) + 1;
    if (!row.application_id) return;
    const key = `${row.application_id}:${row.assessor_id}`;
    const prev = assessmentByAppAssessor[key];
    const prevTs = prev?.submitted_at || prev?.updated_at || "";
    const nextTs = row.submitted_at || row.updated_at || "";
    if (!prev || nextTs >= prevTs) {
      assessmentByAppAssessor[key] = row;
    }
  });

  const enrichedApplications = (applications || []).map((app) => {
    const active = activeByApplication[app.id] || null;
    const assessor = active ? assessorById[active.assessor_id] || null : null;
    const assessmentKey = active ? `${app.id}:${active.assessor_id}` : null;
    const assessment = assessmentKey ? assessmentByAppAssessor[assessmentKey] || null : null;
    const current_assignment = buildCurrentAssignmentPayload(active, assessor, assessment);

    return {
      id: app.id,
      applicant_name: app.full_name || null,
      email: app.profiles?.email || null,
      university: app.university || null,
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
    assignments: (assignments || []).filter((a) => a.status === "active"),
    all_assignments: assignments || [],
    applications: enrichedApplications,
    unassigned_applications: enrichedApplications.filter((app) => !app.current_assignment),
    assignable_statuses: ASSESSOR_ASSIGNABLE_STATUSES,
  });
}
