import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { ASSESSOR_ASSIGNABLE_STATUSES } from "@/lib/assessor-assignment";

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
      admin.from("application_assessments").select("id, assessor_id"),
    ]);

  const activeCountByAssessor = {};
  const assignmentCountByAssessor = {};
  const assignedApplicationIds = new Set();
  (assignments || []).forEach((row) => {
    assignmentCountByAssessor[row.assessor_id] =
      (assignmentCountByAssessor[row.assessor_id] || 0) + 1;
    if (row.status === "active") {
      activeCountByAssessor[row.assessor_id] = (activeCountByAssessor[row.assessor_id] || 0) + 1;
      assignedApplicationIds.add(row.application_id);
    }
  });

  const assessmentCountByAssessor = {};
  (assessments || []).forEach((row) => {
    if (!row.assessor_id) return;
    assessmentCountByAssessor[row.assessor_id] =
      (assessmentCountByAssessor[row.assessor_id] || 0) + 1;
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
    applications: applications || [],
    unassigned_applications: (applications || []).filter((app) => !assignedApplicationIds.has(app.id)),
    assignable_statuses: ASSESSOR_ASSIGNABLE_STATUSES,
  });
}
