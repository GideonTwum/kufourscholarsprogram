import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const INTERVIEW_APP_STATUSES = [
  "stage_2_approved",
  "interview_review_pending",
  "called_for_interview",
  "interview",
];

async function requireDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "director") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requireDirector();
  if (gate.error) return gate.error;

  try {
    const admin = createAdminClient();

    const { data: slots, error: slotsError } = await admin
      .from("interview_slots")
      .select("*")
      .order("interview_date", { ascending: true });

    if (slotsError) {
      return NextResponse.json({ error: slotsError.message }, { status: 500 });
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
  } catch (e) {
    return NextResponse.json(
      { error: e.message || "Server configuration error" },
      { status: 500 }
    );
  }
}
