import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const ASSIGNABLE_STATUSES = [
  "stage_1_submitted",
  "review_pending",
  "stage_2_submitted",
  "stage_2_review_pending",
];

async function requireDirector() {
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

  if (profile?.role !== "director") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  const gate = await requireDirector();
  if (gate.error) return gate.error;

  const admin = createAdminClient();

  const [{ data: assessors }, { data: assignments }, { data: applications }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, email, full_name, created_at")
        .eq("role", "assessor")
        .order("created_at", { ascending: false }),
      admin
        .from("assessor_assignments")
        .select("id, assessor_id, application_id, status, assigned_at")
        .eq("status", "active"),
      admin
        .from("applications")
        .select("id, status, full_name, university, submitted_at, profiles!applications_user_id_fkey(email)")
        .in("status", ASSIGNABLE_STATUSES)
        .order("submitted_at", { ascending: false })
        .limit(500),
    ]);

  const countByAssessor = {};
  const assignedApplicationIds = new Set();
  (assignments || []).forEach((row) => {
    countByAssessor[row.assessor_id] = (countByAssessor[row.assessor_id] || 0) + 1;
    assignedApplicationIds.add(row.application_id);
  });

  return NextResponse.json({
    assessors: (assessors || []).map((a) => ({
      ...a,
      active_assignment_count: countByAssessor[a.id] || 0,
    })),
    assignments: assignments || [],
    applications: applications || [],
    unassigned_applications: (applications || []).filter((app) => !assignedApplicationIds.has(app.id)),
  });
}
