import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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

export async function POST(request) {
  const gate = await requireDirector();
  if (gate.error) return gate.error;

  const body = await request.json();
  const assessorId = body?.assessor_id;
  const applicationIds = Array.isArray(body?.application_ids) ? body.application_ids : [];

  if (!assessorId || applicationIds.length === 0) {
    return NextResponse.json(
      { error: "assessor_id and at least one application_id are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: assessor } = await admin
    .from("profiles")
    .select("id")
    .eq("id", assessorId)
    .eq("role", "assessor")
    .maybeSingle();

  if (!assessor) {
    return NextResponse.json({ error: "Assessor not found." }, { status: 404 });
  }

  const rows = applicationIds.map((applicationId) => ({
    assessor_id: assessorId,
    application_id: applicationId,
    assigned_by: gate.user.id,
    status: "active",
  }));

  const { error } = await admin
    .from("assessor_assignments")
    .upsert(rows, { onConflict: "application_id,assessor_id", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, assigned: rows.length });
}
