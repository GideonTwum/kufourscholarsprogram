import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";

const INTERVIEW_APP_STATUSES = [
  "stage_2_approved",
  "interview_review_pending",
  "called_for_interview",
  "interview",
];

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { data: slots, error: slotsError } = await admin
    .from("interview_slots")
    .select("*")
    .order("interview_date", { ascending: true });

  if (slotsError) {
    return NextResponse.json({ error: "Failed to load interview slots" }, { status: 500 });
  }

  let applications = [];
  const { data: appsJoined, error: appsError } = await admin
    .from("applications")
    .select(
      "id, status, full_name, university, submitted_at, interview_slot_id, interview_shortlisted_at, interview_date, interview_time, interview_location, updated_at, profiles!applications_user_id_fkey(full_name, email)"
    )
    .in("status", INTERVIEW_APP_STATUSES)
    .order("updated_at", { ascending: false });

  if (appsError) {
    const { data: appsFallback } = await admin
      .from("applications")
      .select(
        "id, status, full_name, university, submitted_at, interview_slot_id, interview_shortlisted_at, interview_date, interview_time, interview_location, updated_at"
      )
      .in("status", INTERVIEW_APP_STATUSES);
    applications = appsFallback || [];
  } else {
    applications = appsJoined || [];
  }

  const appIds = applications.map((a) => a.id);
  const assessmentByApp = {};
  if (appIds.length) {
    const { data: assessments } = await admin
      .from("application_assessments")
      .select(
        "application_id, recommendation, overall_score, submitted_at, assessor_name_snapshot"
      )
      .in("application_id", appIds)
      .order("submitted_at", { ascending: false });

    for (const row of assessments || []) {
      if (!assessmentByApp[row.application_id]) {
        assessmentByApp[row.application_id] = {
          recommendation: row.recommendation || null,
          overall_score: row.overall_score ?? null,
          submitted_at: row.submitted_at || null,
          assessor_name: row.assessor_name_snapshot || null,
        };
      }
    }
  }

  const enriched = applications.map((app) => ({
    ...app,
    applicant_name: app.full_name || app.profiles?.full_name || null,
    email: app.profiles?.email || null,
    latest_assessment: assessmentByApp[app.id] || null,
  }));

  const unscheduled = enriched.filter(
    (a) => a.status === "interview_review_pending" && !a.interview_slot_id
  );
  const readyToShortlist = enriched.filter(
    (a) => a.status === "stage_2_approved" && !a.interview_slot_id
  );
  const scheduled = enriched.filter(
    (a) => a.status === "called_for_interview" || (a.interview_slot_id && a.status !== "interview")
  );
  const completedApps = enriched.filter((a) => a.status === "interview");

  const scheduledSlots = (slots || []).filter((s) => (s.status || "scheduled") === "scheduled");
  const completedSlots = (slots || []).filter((s) => s.status === "completed");
  const cancelledSlots = (slots || []).filter((s) => s.status === "cancelled");

  return NextResponse.json({
    slots: slots || [],
    applications: enriched,
    queue: {
      unscheduled,
      ready_to_shortlist: readyToShortlist,
    },
    batches: {
      scheduled: scheduledSlots,
      completed: completedSlots,
      cancelled: cancelledSlots,
    },
    scheduled_applications: scheduled,
    completed_applications: completedApps,
  });
}
