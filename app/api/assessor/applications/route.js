import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function requireAssessor() {
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

  if (profile?.role !== "assessor") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  const gate = await requireAssessor();
  if (gate.error) return gate.error;

  const admin = createAdminClient();
  const { data: assignments, error } = await admin
    .from("assessor_assignments")
    .select("id, status, assigned_at, application_id")
    .eq("assessor_id", gate.user.id)
    .eq("status", "active")
    .order("assigned_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const applicationIds = (assignments || []).map((row) => row.application_id);
  if (applicationIds.length === 0) {
    return NextResponse.json({ applications: [] });
  }

  const { data: applications, error: appError } = await admin
    .from("applications")
    .select("id, user_id, status, full_name, university, program, submitted_at")
    .in("id", applicationIds);

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 500 });
  }

  const userIds = [...new Set((applications || []).map((app) => app.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const applicationsById = Object.fromEntries((applications || []).map((app) => [app.id, app]));

  return NextResponse.json({
    applications: (assignments || []).map((row) => ({
      assignment_id: row.id,
      assigned_at: row.assigned_at,
      ...(applicationsById[row.application_id] || {}),
      profiles: profilesById[applicationsById[row.application_id]?.user_id] || null,
    })),
  });
}
