import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request) {
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

  const body = await request.json();
  const {
    batch_name,
    interview_date,
    interview_time,
    location,
    congratulations_message,
    application_ids = [],
  } = body;

  if (!batch_name || !interview_date || !interview_time || !location) {
    return NextResponse.json(
      { error: "batch_name, interview_date, interview_time, and location are required" },
      { status: 400 }
    );
  }

  const { data: slot, error: slotError } = await supabase
    .from("interview_slots")
    .insert({
      director_id: user.id,
      batch_name,
      interview_date,
      interview_time,
      location,
      congratulations_message: congratulations_message || null,
    })
    .select("id")
    .single();

  if (slotError) {
    return NextResponse.json({ error: slotError.message }, { status: 500 });
  }

  if (application_ids?.length) {
    const { error: updateError } = await supabase
      .from("applications")
      .update({ interview_slot_id: slot.id, updated_at: new Date().toISOString() })
      .in("id", application_ids)
      .eq("status", "interview");

    if (updateError) {
      return NextResponse.json(
        { error: `Slot created but assignment failed: ${updateError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true, slot_id: slot.id });
}
