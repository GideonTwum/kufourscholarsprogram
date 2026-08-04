import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";

const STATUS_KEYS = [
  "draft",
  "stage_1_submitted",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
  "interview_review_pending",
  "called_for_interview",
  "interview",
  "accepted",
  "rejected",
];

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const emptyCounts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));

  const [
    { data: statusRows },
    { count: activeAssessors },
    { count: inactiveAssessors },
    { count: activePanel },
    { count: inactivePanel },
    { count: assessmentCount },
    { count: activeAssignments },
    { count: panelEvals },
    { data: slots },
    { data: openSetting },
    { data: deadlineSetting },
    { data: recentAudit },
  ] = await Promise.all([
    admin.from("applications").select("status"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "assessor")
      .eq("is_active", true),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "assessor")
      .eq("is_active", false),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "panel")
      .eq("is_active", true),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "panel")
      .eq("is_active", false),
    admin.from("application_assessments").select("id", { count: "exact", head: true }),
    admin
      .from("assessor_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    admin.from("interview_evaluations").select("id", { count: "exact", head: true }),
    admin.from("interview_slots").select("id, status, interview_date"),
    admin.from("site_settings").select("value").eq("key", "applications_open").maybeSingle(),
    admin.from("site_settings").select("value").eq("key", "application_deadline").maybeSingle(),
    admin
      .from("director_audit_events")
      .select("id, action, entity_type, entity_id, actor_name_snapshot, actor_email_snapshot, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const byStatus = { ...emptyCounts };
  let total = 0;
  for (const row of statusRows || []) {
    const s = row.status || "unknown";
    if (byStatus[s] != null) byStatus[s] += 1;
    total += 1;
  }

  const stage1Pending = (byStatus.stage_1_submitted || 0) + (byStatus.review_pending || 0);
  const stage2Pending =
    (byStatus.stage_2_submitted || 0) + (byStatus.stage_2_review_pending || 0);
  const interviews =
    (byStatus.called_for_interview || 0) +
    (byStatus.interview || 0) +
    (byStatus.interview_review_pending || 0);

  const today = new Date().toISOString().slice(0, 10);
  const scheduledSlots = (slots || []).filter((s) => (s.status || "scheduled") === "scheduled");
  const upcomingInterviews = scheduledSlots.filter((s) => s.interview_date >= today).length;

  const assessmentsPending = Math.max(0, (activeAssignments || 0) - (assessmentCount || 0));

  return NextResponse.json({
    totals: {
      total_applications: total,
      stage_1_pending: stage1Pending,
      stage_2_pending: stage2Pending,
      interviews,
      accepted: byStatus.accepted || 0,
      rejected: byStatus.rejected || 0,
    },
    by_status: byStatus,
    staff: {
      active_assessors: activeAssessors || 0,
      inactive_assessors: inactiveAssessors || 0,
      active_panel: activePanel || 0,
      inactive_panel: inactivePanel || 0,
      assessments_completed: assessmentCount || 0,
      assessments_pending_estimate: assessmentsPending,
      active_assignments: activeAssignments || 0,
      panel_evaluations: panelEvals || 0,
    },
    interviews: {
      batches: (slots || []).length,
      scheduled: scheduledSlots.length,
      upcoming: upcomingInterviews,
    },
    settings: {
      applications_open: openSetting?.value === "true",
      application_deadline: deadlineSetting?.value || null,
    },
    recent_activity: recentAudit || [],
  });
}
