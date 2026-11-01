import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import {
  ensureInterviewSchedule,
  fetchInterviewScheduleDays,
  findScheduleDay,
} from "@/lib/director-interview-schedule";
import {
  INTERVIEW_SLOTS_TABLE,
  occupancyFromRows,
  summarizeBatchOccupancy,
} from "@/lib/director-interview-batches";
import { INTERVIEW_ALLOCATION_TABLE } from "@/lib/director-interview-allocation";

async function loadSchedule(admin) {
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", APPLICATION_CLASS_SETTING_KEY)
    .maybeSingle();
  const className =
    (typeof data?.value === "string" && data.value.trim()) || DEFAULT_APPLICATION_CLASS_NAME;
  const { schedule, error } = await ensureInterviewSchedule(admin, className);
  if (error || !schedule) return { error: error?.message || "schedule_unavailable" };
  const { days, error: daysErr } = await fetchInterviewScheduleDays(admin, schedule.id);
  if (daysErr) return { error: daysErr.message, schedule };
  return { schedule, days, className };
}

async function occupancyForSlots(admin, slotIds) {
  if (!slotIds.length) return {};
  const { data: allocs } = await admin
    .from(INTERVIEW_ALLOCATION_TABLE)
    .select("application_id, interview_slot_id")
    .in("interview_slot_id", slotIds);
  const { data: apps } = await admin
    .from("applications")
    .select("id, interview_slot_id")
    .in("interview_slot_id", slotIds);
  return occupancyFromRows([...(allocs || []), ...(apps || [])]);
}

/**
 * Compatibility route: lists existing interview_slots batches. Automatic generation is disabled.
 */
export async function GET(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const url = new URL(request.url);
  const dayId = url.searchParams.get("dayId") || "";
  const loaded = await loadSchedule(admin);
  if (loaded.error) {
    return NextResponse.json({ error: loaded.error, code: "SCHEDULE_UNAVAILABLE" }, { status: 503 });
  }
  const day = findScheduleDay(loaded.days, dayId);
  if (!day) return NextResponse.json({ error: "Interview date not found" }, { status: 404 });

  const { data: slots, error } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select(
      "id, batch_name, interview_date, interview_time, end_time, capacity, published_at, invitation_sent_at, location, meeting_link, schedule_day_id, status"
    )
    .eq("interview_date", day.interview_date)
    .neq("status", "cancelled")
    .order("interview_time", { ascending: true });
  if (error) {
    return NextResponse.json(
      {
        error: "Interview batch columns are unavailable. Apply supabase-migration-interview-batch-drafts.sql.",
        code: "BATCHES_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  const bookedBySlot = await occupancyForSlots(admin, (slots || []).map((slot) => slot.id));
  const batches = summarizeBatchOccupancy(slots || [], bookedBySlot);
  const available = batches
    .filter((batch) => !batch.published && !batch.full)
    .map((batch) => ({
      id: batch.id,
      start_time: batch.interview_time || batch.start_time,
      end_time: batch.end_time,
      capacity: batch.capacity,
      booked: batch.booked,
      available: batch.available,
    }));

  return NextResponse.json({
    day,
    batches,
    appointments: [],
    available,
    notify_applicants: false,
    individual_appointments_disabled: true,
  });
}

export async function POST() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  return NextResponse.json(
    {
      error: "Automatic batch generation is disabled. Create each interview batch manually.",
      code: "MANUAL_BATCHES_REQUIRED",
      notify_applicants: false,
    },
    { status: 410 }
  );
}
