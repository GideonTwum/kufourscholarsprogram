import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import {
  INTERVIEW_SCHEDULE_DAYS_TABLE,
  INTERVIEW_SCHEDULE_TABLE,
  INTERVIEW_SCHEDULE_TIMEZONE,
  canDeleteInterviewScheduleDay,
  countAllocationsForScheduleDay,
  ensureInterviewSchedule,
  fetchInterviewScheduleDays,
  normalizeInterviewClockTime,
  validateInterviewScheduleDay,
} from "@/lib/director-interview-schedule";
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  INTERVIEW_SCHEDULE_BREAKS_TABLE,
  generateInterviewAppointments,
  normalizeAppointmentDuration,
  validateBreakWithinWindow,
} from "@/lib/director-interview-appointments";
import {
  DEFAULT_INTERVIEW_POLICY,
  DEFAULT_RESCHEDULE_POLICY,
} from "@/lib/director-interview-invitations";
import { normalizeVirtualEligibleStudyRegions } from "@/lib/director-location-filter";

async function currentClassName(admin) {
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", APPLICATION_CLASS_SETTING_KEY)
    .maybeSingle();
  const value = typeof data?.value === "string" ? data.value.trim() : "";
  return value || DEFAULT_APPLICATION_CLASS_NAME;
}

async function loadWorkspace(admin) {
  const className = await currentClassName(admin);
  const { schedule, error } = await ensureInterviewSchedule(admin, className);
  if (error || !schedule) {
    return { error: error?.message || "Failed to load interview schedule", className };
  }
  const { days, error: daysErr } = await fetchInterviewScheduleDays(admin, schedule.id);
  if (daysErr) {
    return { error: daysErr.message || "Failed to load interview dates", className, schedule };
  }
  const duration = normalizeAppointmentDuration(
    schedule.appointment_duration_minutes,
    DEFAULT_APPOINTMENT_DURATION_MINUTES
  );
  let breakRows = [];
  try {
    const loaded = await admin
      .from(INTERVIEW_SCHEDULE_BREAKS_TABLE)
      .select("id, schedule_day_id, start_time, end_time")
      .in(
        "schedule_day_id",
        days.map((d) => d.id).concat(["00000000-0000-0000-0000-000000000000"])
      );
    breakRows = loaded.data || [];
  } catch {
    breakRows = [];
  }
  const breaksByDay = new Map();
  for (const row of breakRows || []) {
    const list = breaksByDay.get(row.schedule_day_id) || [];
    list.push({
      id: row.id,
      start_time: String(row.start_time || "").slice(0, 5),
      end_time: String(row.end_time || "").slice(0, 5),
    });
    breaksByDay.set(row.schedule_day_id, list);
  }
  const withCounts = [];
  for (const day of days) {
    const allocationCount = await countAllocationsForScheduleDay(admin, day.id);
    const breaks = breaksByDay.get(day.id) || [];
    const generated = generateInterviewAppointments({
      startTime: day.start_time,
      endTime: day.end_time,
      durationMinutes: duration,
      breaks,
    });
    withCounts.push({
      ...day,
      allocation_count: allocationCount,
      breaks,
      capacity: generated.capacity,
    });
  }
  return {
    className,
    schedule: {
      ...schedule,
      timezone: schedule.timezone || INTERVIEW_SCHEDULE_TIMEZONE,
      appointment_duration_minutes: duration,
      arrival_minutes: schedule.arrival_minutes ?? 15,
      policy_wording: schedule.policy_wording || DEFAULT_INTERVIEW_POLICY,
      reschedule_policy_wording: schedule.reschedule_policy_wording || DEFAULT_RESCHEDULE_POLICY,
      virtual_eligible_study_regions: Array.isArray(schedule.virtual_eligible_study_regions)
        ? schedule.virtual_eligible_study_regions
        : [],
    },
    days: withCounts,
  };
}

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;

  const workspace = await loadWorkspace(adminGate.admin);
  if (workspace.error) {
    return NextResponse.json(
      {
        error:
          workspace.error.includes("schema") || workspace.error.includes("does not exist")
            ? "Interview schedule tables are unavailable. Apply supabase-migration-interview-allocation.sql."
            : workspace.error,
        code: "SCHEDULE_UNAVAILABLE",
      },
      { status: 503 }
    );
  }
  return NextResponse.json(workspace);
}

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workspace = await loadWorkspace(admin);
  if (workspace.error) {
    return NextResponse.json({ error: workspace.error }, { status: 503 });
  }

  const validated = validateInterviewScheduleDay({
    interviewDate: body.interview_date,
    startTime: body.start_time ?? "08:00",
    endTime: body.end_time ?? "16:00",
    existingDates: workspace.days.map((d) => d.interview_date),
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data, error } = await admin
    .from(INTERVIEW_SCHEDULE_DAYS_TABLE)
    .insert({
      schedule_id: workspace.schedule.id,
      interview_date: validated.interview_date,
      start_time: validated.start_time,
      end_time: validated.end_time,
      is_active: body.is_active !== false,
    })
    .select("id, schedule_id, interview_date, start_time, end_time, is_active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to add interview date" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview_schedule.day_created",
    entityType: INTERVIEW_SCHEDULE_DAYS_TABLE,
    entityId: data?.id,
    newValue: data,
    request,
  });

  return NextResponse.json({ success: true, day: data });
}

export async function PATCH(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.scope === "schedule") {
    const workspace = await loadWorkspace(admin);
    if (workspace.error) return NextResponse.json({ error: workspace.error }, { status: 503 });
    const duration = normalizeAppointmentDuration(
      body.appointment_duration_minutes,
      workspace.schedule.appointment_duration_minutes
    );
    const patch = {
      appointment_duration_minutes: duration,
      updated_at: new Date().toISOString(),
    };
    for (const key of [
      "physical_venue",
      "whatsapp_contact",
      "physical_instructions",
      "virtual_instructions",
      "required_documents_physical",
      "required_documents_virtual",
      "policy_wording",
      "reschedule_policy_wording",
    ]) {
      if (body[key] !== undefined) patch[key] = String(body[key] || "").trim() || null;
    }
    if (body.arrival_minutes != null) {
      const arrival = Number(body.arrival_minutes);
      if (!Number.isInteger(arrival) || arrival < 0 || arrival > 120) {
        return NextResponse.json({ error: "invalid_arrival_minutes" }, { status: 400 });
      }
      patch.arrival_minutes = arrival;
    }
    if (body.virtual_eligible_study_regions !== undefined) {
      patch.virtual_eligible_study_regions = normalizeVirtualEligibleStudyRegions(
        body.virtual_eligible_study_regions
      );
    }
    const { data, error } = await admin
      .from(INTERVIEW_SCHEDULE_TABLE)
      .update(patch)
      .eq("id", workspace.schedule.id)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recordDirectorAudit({
      actor: gate.profile,
      action: "interview_schedule.settings_updated",
      entityType: INTERVIEW_SCHEDULE_TABLE,
      entityId: workspace.schedule.id,
      newValue: patch,
      request,
    });
    return NextResponse.json({ success: true, schedule: data, notify_applicants: false });
  }

  if (body.scope === "breaks") {
    const dayId = typeof body.day_id === "string" ? body.day_id.trim() : "";
    const workspace = await loadWorkspace(admin);
    if (workspace.error) return NextResponse.json({ error: workspace.error }, { status: 503 });
    const day = workspace.days.find((d) => d.id === dayId);
    if (!day) return NextResponse.json({ error: "Interview date not found" }, { status: 404 });
    const incoming = Array.isArray(body.breaks) ? body.breaks : [];
    const normalized = [];
    for (const br of incoming) {
      const checked = validateBreakWithinWindow(br, day.start_time, day.end_time);
      if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
      normalized.push({
        schedule_day_id: dayId,
        start_time: checked.start_time,
        end_time: checked.end_time,
      });
    }
    await admin.from(INTERVIEW_SCHEDULE_BREAKS_TABLE).delete().eq("schedule_day_id", dayId);
    if (normalized.length) {
      const { error } = await admin.from(INTERVIEW_SCHEDULE_BREAKS_TABLE).insert(normalized);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, breaks: normalized, notify_applicants: false });
  }

  const dayId = typeof body.id === "string" ? body.id.trim() : "";
  if (!dayId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const workspace = await loadWorkspace(admin);
  if (workspace.error) return NextResponse.json({ error: workspace.error }, { status: 503 });
  const current = workspace.days.find((d) => d.id === dayId);
  if (!current) return NextResponse.json({ error: "Interview date not found" }, { status: 404 });

  const nextDate = body.interview_date ?? current.interview_date;
  const nextStart = body.start_time ?? current.start_time;
  const nextEnd = body.end_time ?? current.end_time;
  const validated = validateInterviewScheduleDay({
    interviewDate: nextDate,
    startTime: nextStart,
    endTime: nextEnd,
    existingDates: workspace.days.map((d) => d.interview_date),
    excludeDate: current.interview_date,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const patch = {
    interview_date: validated.interview_date,
    start_time: validated.start_time,
    end_time: validated.end_time,
    updated_at: new Date().toISOString(),
  };
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  const { data, error } = await admin
    .from(INTERVIEW_SCHEDULE_DAYS_TABLE)
    .update(patch)
    .eq("id", dayId)
    .select("id, schedule_id, interview_date, start_time, end_time, is_active")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to update interview date" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview_schedule.day_updated",
    entityType: INTERVIEW_SCHEDULE_DAYS_TABLE,
    entityId: dayId,
    oldValue: current,
    newValue: data,
    request,
  });

  return NextResponse.json({ success: true, day: data });
}

export async function DELETE(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const url = new URL(request.url);
  let dayId = url.searchParams.get("dayId") || "";
  if (!dayId) {
    try {
      const body = await request.json();
      dayId = typeof body?.id === "string" ? body.id : "";
    } catch {
      dayId = "";
    }
  }
  if (!dayId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allocationCount = await countAllocationsForScheduleDay(admin, dayId);
  const allowed = canDeleteInterviewScheduleDay(allocationCount);
  if (!allowed.ok) {
    return NextResponse.json(
      {
        error: "Reassign or unallocate applicants before deleting this date.",
        code: allowed.error,
        allocation_count: allowed.allocationCount,
      },
      { status: 409 }
    );
  }

  const { error } = await admin.from(INTERVIEW_SCHEDULE_DAYS_TABLE).delete().eq("id", dayId);
  if (error) {
    return NextResponse.json({ error: error.message || "Failed to delete interview date" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview_schedule.day_deleted",
    entityType: INTERVIEW_SCHEDULE_DAYS_TABLE,
    entityId: dayId,
    request,
  });

  return NextResponse.json({ success: true });
}
