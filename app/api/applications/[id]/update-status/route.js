import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: directorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (directorProfile?.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, director_notes, class_name } = body;

  const validStatuses = [
    "submitted",
    "under_review",
    "shortlisted",
    "interview",
    "accepted",
    "rejected",
  ];

  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Update the application status
  const updatePayload = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (director_notes !== undefined) {
    updatePayload.director_notes = director_notes;
  }

  const { error: appError } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", id);

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 500 });
  }

  // On acceptance: promote applicant to scholar and assign class
  if (status === "accepted") {
    if (!class_name) {
      return NextResponse.json(
        { error: "class_name is required when accepting an applicant" },
        { status: 400 }
      );
    }

    const { data: application } = await supabase
      .from("applications")
      .select("user_id")
      .eq("id", id)
      .single();

    if (application) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "scholar", class_name })
        .eq("id", application.user_id);

      if (profileError) {
        return NextResponse.json(
          { error: `Application accepted but failed to update profile: ${profileError.message}` },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
