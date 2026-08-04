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

  const { data: applications, error: appsError } = await admin
    .from("applications")
    .select("*, profiles!applications_user_id_fkey(full_name, email)")
    .in("status", INTERVIEW_APP_STATUSES)
    .order("submitted_at", { ascending: false });

  if (appsError) {
    const { data: appsFallback } = await admin
      .from("applications")
      .select("*")
      .in("status", INTERVIEW_APP_STATUSES)
      .order("submitted_at", { ascending: false });
    return NextResponse.json({
      slots: slots || [],
      applications: appsFallback || [],
    });
  }

  return NextResponse.json({
    slots: slots || [],
    applications: applications || [],
  });
}
