import { requireActiveAssessor, getAdminOrError } from "@/lib/director-auth";
import {
  ASSESSOR_APPLICATION_SELECT,
  pickAssessorSafeApplication,
} from "@/lib/assessor-workflow";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireActiveAssessor();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { data: assignments, error } = await admin
    .from("assessor_assignments")
    .select("id, status, assigned_at, application_id")
    .eq("assessor_id", gate.user.id)
    .eq("status", "active")
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
  }

  const applicationIds = (assignments || []).map((row) => row.application_id);
  if (applicationIds.length === 0) {
    return NextResponse.json({ applications: [] });
  }

  const { data: applications, error: appError } = await admin
    .from("applications")
    .select(ASSESSOR_APPLICATION_SELECT)
    .in("id", applicationIds);

  if (appError) {
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }

  const userIds = [...new Set((applications || []).map((app) => app.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const applicationsById = Object.fromEntries((applications || []).map((app) => [app.id, app]));

  const { data: myAssessments } = await admin
    .from("application_assessments")
    .select("application_id, stage, recommendation, submitted_at, updated_at")
    .eq("assessor_id", gate.user.id)
    .in("application_id", applicationIds);

  const assessmentByApp = {};
  for (const row of myAssessments || []) {
    assessmentByApp[row.application_id] = row;
  }

  return NextResponse.json({
    applications: (assignments || []).map((row) => {
      const app = applicationsById[row.application_id];
      const safe = pickAssessorSafeApplication({
        ...(app || {}),
        profiles: profilesById[app?.user_id] || null,
      });
      return {
        assignment_id: row.id,
        assigned_at: row.assigned_at,
        assignment_status: row.status,
        has_assessment: Boolean(assessmentByApp[row.application_id]),
        my_assessment: assessmentByApp[row.application_id] || null,
        ...safe,
      };
    }),
  });
}
