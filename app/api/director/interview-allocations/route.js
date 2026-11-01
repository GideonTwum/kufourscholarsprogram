import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import {
  fetchAllApplicationPages,
  fetchAllRowsForIds,
} from "@/lib/director-application-scope";
import {
  INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES,
  INTERVIEW_ALLOCATION_TABLE,
  MAX_INTERVIEW_ALLOCATION_BATCH,
  attachScheduleDaysToAllocations,
  confirmInterviewAllocationPreview,
  fetchInterviewAllocationsMap,
  filterInterviewAllocationRows,
  isEligibleForInterviewAllocation,
  persistDirectorInterviewAllocations,
  planDirectorInterviewAllocations,
  presentInterviewAllocationRow,
  summarizeInterviewAllocationCounts,
} from "@/lib/director-interview-allocation";
import { directorApplicationMatchesSearch } from "@/lib/director-application-workflow";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import {
  ensureInterviewSchedule,
  fetchInterviewScheduleDays,
  findScheduleDay,
} from "@/lib/director-interview-schedule";
import {
  INTERVIEW_SCHEDULE_BREAKS_TABLE,
  generateInterviewAppointments,
  normalizeAppointmentDuration,
} from "@/lib/director-interview-appointments";
import {
  INTERVIEW_SLOTS_TABLE,
  planBatchAssignments,
  summarizeBatchOccupancy,
} from "@/lib/director-interview-batches";
import {
  attachLocationConfirmations,
  fetchInterviewLocationConfirmationsMap,
  uniqueInterviewInstitutionOptions,
  uniqueInterviewTownOptions,
} from "@/lib/director-interview-location";
import { normalizeVirtualEligibleStudyRegions } from "@/lib/director-location-filter";

const ELIGIBLE_APP_SELECT =
  "id, status, full_name, university, region, hometown, current_town, address, interview_slot_id, stage_2_approved_at, stage_2_submitted_at, video_youtube_url, profiles!applications_user_id_fkey(full_name, email)";

async function loadEligibleApplications(admin) {
  const { data, error } = await fetchAllApplicationPages(() =>
    admin
      .from("applications")
      .select(ELIGIBLE_APP_SELECT)
      .in("status", INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES)
      .order("full_name", { ascending: true, nullsFirst: false })
  );
  if (error) {
    const fallback = await fetchAllApplicationPages(() =>
      admin
        .from("applications")
        .select(
          "id, status, full_name, university, region, hometown, address, interview_slot_id, stage_2_approved_at, stage_2_submitted_at, video_youtube_url"
        )
        .in("status", INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES)
        .order("full_name", { ascending: true, nullsFirst: false })
    );
    return { applications: fallback.data || [], loadError: fallback.error || error };
  }
  return { applications: data || [], loadError: null };
}

function eligibleRowsWithAllocations(applications, allocationsById) {
  return (applications || [])
    .filter((app) => isEligibleForInterviewAllocation(app))
    .map((app) => ({
      app,
      allocation: allocationsById[app.id] || null,
    }));
}

async function loadScheduleDays(admin) {
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", APPLICATION_CLASS_SETTING_KEY)
    .maybeSingle();
  const className =
    (typeof data?.value === "string" && data.value.trim()) || DEFAULT_APPLICATION_CLASS_NAME;
  const { schedule, error } = await ensureInterviewSchedule(admin, className);
  if (error || !schedule) return { days: [], schedule: null, error };
  const { days, error: daysErr } = await fetchInterviewScheduleDays(admin, schedule.id);
  if (daysErr || !days?.length) return { days: days || [], schedule, error: daysErr || null };

  const duration = normalizeAppointmentDuration(schedule.appointment_duration_minutes);
  const { data: breaks, error: breakErr } = await admin
    .from(INTERVIEW_SCHEDULE_BREAKS_TABLE)
    .select("schedule_day_id, start_time, end_time")
    .in(
      "schedule_day_id",
      days.map((day) => day.id)
    );
  const breaksByDay = new Map();
  if (!breakErr) {
    for (const row of breaks || []) {
      const list = breaksByDay.get(row.schedule_day_id) || [];
      list.push({
        start_time: String(row.start_time || "").slice(0, 5),
        end_time: String(row.end_time || "").slice(0, 5),
      });
      breaksByDay.set(row.schedule_day_id, list);
    }
  }
  const { data: slotRows } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, interview_date, schedule_day_id, status")
    .neq("status", "cancelled");
  const generatedByDay = new Map();
  for (const slot of slotRows || []) {
    const key = slot.schedule_day_id || slot.interview_date;
    if (!key) continue;
    generatedByDay.set(key, (generatedByDay.get(key) || 0) + 1);
  }

  return {
    days: days.map((day) => {
      const generated = generateInterviewAppointments({
        startTime: day.start_time,
        endTime: day.end_time,
        durationMinutes: duration,
        breaks: breaksByDay.get(day.id) || [],
      });
      return {
        ...day,
        capacity: generated.ok ? generated.capacity : null,
        generated_count: generatedByDay.get(day.id) || generatedByDay.get(day.interview_date) || 0,
      };
    }),
    schedule,
    error: null,
  };
}

async function attachSlotsToAllocations(admin, allocationsById) {
  const ids = [
    ...new Set(
      Object.values(allocationsById || {})
        .map((row) => row?.interview_slot_id)
        .filter(Boolean)
    ),
  ];
  if (!ids.length) return allocationsById;
  const { data, error } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, batch_name, interview_date, interview_time, end_time, capacity, published_at, location, meeting_link, schedule_day_id, status")
    .in("id", ids);
  if (error) return allocationsById;
  const byId = new Map((data || []).map((row) => [row.id, row]));
  const out = {};
  for (const [appId, allocation] of Object.entries(allocationsById || {})) {
    if (appId === "__error") continue;
    const slot = byId.get(allocation?.interview_slot_id);
    out[appId] = slot ? { ...allocation, slot } : allocation;
  }
  return out;
}

async function loadDraftBatches(admin, days = []) {
  const dayIds = (days || []).map((day) => day.id).filter(Boolean);
  const dates = (days || []).map((day) => day.interview_date).filter(Boolean);
  let query = admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, batch_name, interview_date, interview_time, end_time, capacity, published_at, location, meeting_link, schedule_day_id, status")
    .neq("status", "cancelled")
    .order("interview_date", { ascending: true });
  const { data, error } = await query;
  if (error) return [];
  return (data || []).filter((slot) => {
    if (slot.schedule_day_id && dayIds.includes(slot.schedule_day_id)) return true;
    return dates.includes(slot.interview_date);
  });
}

export async function GET(request) {
  try {
    const gate = await requireActiveDirector();
    if (gate.error) return gate.error;

    const adminGate = await getAdminOrError();
    if (adminGate.error) return adminGate.error;
    const admin = adminGate.admin;

  const url = new URL(request.url);
  const region = url.searchParams.get("region") || "";
  const town = url.searchParams.get("town") || "";
  const alloc = url.searchParams.get("alloc") || "";
  const idate = url.searchParams.get("idate") || "";
  const stage2 = url.searchParams.get("stage2") || "";
  const loc = url.searchParams.get("loc") || "";
  const institution = url.searchParams.get("institution") || "";
  const q = url.searchParams.get("q") || "";

  const { days, schedule, error: daysErr } = await loadScheduleDays(admin);
  if (daysErr) {
    return NextResponse.json(
      {
        error:
          daysErr.message ||
          "Interview schedule tables are unavailable. Apply supabase-migration-interview-allocation.sql in the SQL editor.",
        code: "ALLOCATION_TABLE_MISSING",
      },
      { status: 503 }
    );
  }

  const { applications, loadError } = await loadEligibleApplications(admin);
  const ids = applications.map((a) => a.id);
  const allocationsById = await fetchInterviewAllocationsMap(admin, ids);
  if (allocationsById.__error) {
    return NextResponse.json(
      {
        error:
          allocationsById.__error.message ||
          "Interview allocation table is unavailable. Apply supabase-migration-interview-allocation.sql in the SQL editor.",
        code: "ALLOCATION_TABLE_MISSING",
      },
      { status: 503 }
    );
  }

  const withSlots = await attachSlotsToAllocations(admin, allocationsById);
  const withDays = attachScheduleDaysToAllocations(withSlots, days);
  const confirmationsById = await fetchInterviewLocationConfirmationsMap(admin, ids);
  const confirmations = confirmationsById.__error ? {} : confirmationsById;
  const eligible = attachLocationConfirmations(
    eligibleRowsWithAllocations(applications, withDays),
    confirmations
  );
  const counts = summarizeInterviewAllocationCounts(eligible, days);
  const town_options = uniqueInterviewTownOptions(eligible);
  const institution_options = uniqueInterviewInstitutionOptions(eligible);
  const virtualEligibleRegions = normalizeVirtualEligibleStudyRegions(
    schedule?.virtual_eligible_study_regions
  );
  const rawBatches = await loadDraftBatches(admin, days);
  const bookedBySlot = {};
  for (const row of eligible) {
    const slotId = row?.allocation?.interview_slot_id;
    if (slotId) bookedBySlot[slotId] = (bookedBySlot[slotId] || 0) + 1;
  }
  const batches = summarizeBatchOccupancy(rawBatches, bookedBySlot);
  let rows = filterInterviewAllocationRows(
    eligible,
    { region, town, alloc, idate, stage2, loc, institution },
    days
  );
  if (q.trim()) {
    rows = rows.filter(({ app }) => directorApplicationMatchesSearch(app, q));
  }

  return NextResponse.json({
    counts,
    days,
    town_options,
    institution_options,
    virtual_eligible_study_regions: virtualEligibleRegions,
    batches,
    applicants: rows.map((row) =>
      presentInterviewAllocationRow(row, days, { virtualEligibleRegions })
    ),
    filters: { region, town, alloc, idate, stage2, loc, institution, q },
    load_error: loadError?.message || null,
    notify_applicants: false,
  });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load interview allocations",
        code: "ALLOCATION_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
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

  const action = typeof body?.action === "string" ? body.action.trim() : "";
  const scheduleDayId = body?.schedule_day_id || body?.interview_date || null;
  const confirm = body?.confirm === true;
  const selectedIds = Array.isArray(body?.application_ids) ? body.application_ids : [];

  if (selectedIds.length > MAX_INTERVIEW_ALLOCATION_BATCH) {
    return NextResponse.json(
      { error: `Select at most ${MAX_INTERVIEW_ALLOCATION_BATCH} applicants.` },
      { status: 400 }
    );
  }

  const uniqueIds = [...new Set(selectedIds.map((id) => String(id || "")).filter(Boolean))];
  if (!uniqueIds.length) {
    return NextResponse.json({ error: "Select at least one applicant." }, { status: 400 });
  }

  const { data: applications, error: loadErr } = await fetchAllRowsForIds(
    (chunkIds) =>
      admin
        .from("applications")
        .select(
          "id, status, interview_slot_id, stage_2_approved_at, region, current_town, full_name"
        )
        .in("id", chunkIds),
    uniqueIds
  );

  if (loadErr) {
    return NextResponse.json(
      { error: loadErr.message || "Failed to load selected applicants.", code: "ALLOCATION_LOAD_FAILED" },
      { status: 500 }
    );
  }

  const { days, error: daysErr } = await loadScheduleDays(admin);
  if (daysErr) {
    return NextResponse.json(
      {
        error:
          daysErr.message ||
          "Interview schedule tables are unavailable. Apply supabase-migration-interview-allocation.sql in the SQL editor.",
        code: "ALLOCATION_TABLE_MISSING",
      },
      { status: 503 }
    );
  }

  const allocationsById = await fetchInterviewAllocationsMap(admin, uniqueIds);
  if (allocationsById.__error) {
    return NextResponse.json(
      {
        error:
          allocationsById.__error.message ||
          "Interview allocation table is unavailable. Apply supabase-migration-interview-allocation.sql in the SQL editor.",
        code: "ALLOCATION_TABLE_MISSING",
      },
      { status: 503 }
    );
  }

  const withDays = attachScheduleDaysToAllocations(allocationsById, days);
  const allowMove = body?.allow_move === true;
  const slotsById = {};
  const currentSlotIds = [
    ...new Set(
      uniqueIds
        .map((id) => withDays[id]?.interview_slot_id)
        .concat((applications || []).map((app) => app.interview_slot_id))
        .filter(Boolean)
    ),
  ];
  if (currentSlotIds.length) {
    const { data: currentSlots } = await admin
      .from(INTERVIEW_SLOTS_TABLE)
      .select(
        "id, batch_name, interview_date, interview_time, end_time, capacity, published_at, invitation_sent_at, schedule_day_id, status"
      )
      .in("id", currentSlotIds);
    for (const slot of currentSlots || []) slotsById[slot.id] = slot;
  }
  let assignments = Array.isArray(body.assignments) ? body.assignments : [];
  let interviewSlot = null;
  if (action === "allocate_batch") {
    const slotId = typeof body.interview_slot_id === "string" ? body.interview_slot_id.trim() : "";
    if (!slotId) return NextResponse.json({ error: "interview_slot_id required" }, { status: 400 });
    let { data: slot } = await admin
      .from(INTERVIEW_SLOTS_TABLE)
      .select("id, batch_name, interview_date, interview_time, end_time, capacity, published_at, schedule_day_id, status, location")
      .eq("id", slotId)
      .maybeSingle();
    if (!slot) {
      const fallback = await admin
        .from(INTERVIEW_SLOTS_TABLE)
        .select("id, batch_name, interview_date, interview_time, location, status")
        .eq("id", slotId)
        .maybeSingle();
      slot = fallback.data;
    }
    if (!slot || slot.status === "cancelled") {
      return NextResponse.json({ error: "batch_not_found" }, { status: 404 });
    }
    if (slot.published_at) {
      return NextResponse.json({ error: "batch_already_published" }, { status: 409 });
    }
    interviewSlot = slot;
    slotsById[slot.id] = slot;
    const { data: occupiedAllocations } = await admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .select("application_id, interview_slot_id")
      .eq("interview_slot_id", slot.id);
    const { data: occupiedApps } = await admin
      .from("applications")
      .select("id, interview_slot_id")
      .eq("interview_slot_id", slot.id);
    const occupiedInviteeResult = await admin
      .from("interview_special_invitees")
      .select("id, interview_slot_id")
      .eq("interview_slot_id", slot.id);
    const occupiedInvitees = occupiedInviteeResult.error ? [] : occupiedInviteeResult.data;
    const selectedSet = new Set(uniqueIds);
    const occupiedIds = new Set([
      ...(occupiedAllocations || []).map((row) => row.application_id),
      ...(occupiedApps || []).map((row) => row.id),
    ]);
    const bookedApplicants = [...occupiedIds].filter((id) => !selectedSet.has(id)).length;
    const bookedInvitees = (occupiedInvitees || []).length;
    const booked = bookedApplicants + bookedInvitees;
    const sequential = planBatchAssignments({
      selectedIds: uniqueIds,
      slot,
      booked,
    });
    if (!sequential.ok) {
      return NextResponse.json(
        { error: sequential.error, shortfall: sequential.shortfall, available: sequential.available },
        { status: 409 }
      );
    }
    assignments = sequential.assignments;
  }
  const scheduleDay = findScheduleDay(days, scheduleDayId || interviewSlot?.schedule_day_id || interviewSlot?.interview_date);
  const plan = planDirectorInterviewAllocations({
    applications: applications || [],
    allocationsById: withDays,
    selectedIds: uniqueIds,
    action,
    scheduleDay,
    scheduleDayId: scheduleDayId || interviewSlot?.schedule_day_id,
    days,
    assignments,
    interviewSlot,
    interviewFormat: body.interview_format === "virtual" ? "virtual" : "in_person",
    allowMove,
    slotsById,
  });

  if (!plan.ok) {
    const status = plan.error === "invalid_interview_date" || plan.error === "invalid_action" ? 400 : 400;
    return NextResponse.json(
      { error: plan.error, skipped: plan.skipped, errors: plan.errors },
      { status }
    );
  }

  if (action === "allocate_batch") {
    const conflicts = (plan.skipped || []).filter((row) =>
      ["already_assigned_other_batch", "already_on_published_batch", "published_locked"].includes(
        row.reason
      )
    );
    if (conflicts.length) {
      return NextResponse.json(
        {
          error: conflicts[0].reason,
          conflicts,
          skipped: plan.skipped,
          notify_applicants: false,
        },
        { status: 409 }
      );
    }
  }

  if (!confirm) {
    const namesById = Object.fromEntries(
      (applications || []).map((app) => [app.id, app.full_name || app.id])
    );
    return NextResponse.json({
      preview: confirmInterviewAllocationPreview(plan, days, { namesById, assignments }),
      changing: plan.changing.map((row) => ({
        id: row.id,
        previous: row.previous,
        next: row.next,
      })),
      skipped: plan.skipped,
      notify_applicants: false,
    });
  }

  if (plan.changing.length === 0) {
    return NextResponse.json({
      success: true,
      updated: 0,
      skipped: plan.skipped,
      unchanged: plan.apply.filter((row) => row.unchanged).length,
      notify_applicants: false,
    });
  }

  const persisted = await persistDirectorInterviewAllocations(admin, {
    plan,
    actorId: gate.profile?.id || gate.user?.id,
    interviewSlot,
  });

  if (persisted.error) {
    return NextResponse.json(
      {
        error: persisted.error,
        available: persisted.available,
        needed: persisted.needed,
        skipped: persisted.skipped,
      },
      { status: persisted.status || 500 }
    );
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: `interview_allocation.${action}`,
    entityType: INTERVIEW_ALLOCATION_TABLE,
    entityId: null,
    oldValue: plan.changing.map((row) => ({ id: row.id, ...row.previous })),
    newValue: plan.changing.map((row) => ({ id: row.id, ...row.next })),
    metadata: {
      count: plan.changing.length,
      skipped: plan.skipped.length,
      schedule_day_id: action === "allocate_physical" ? scheduleDay?.id || null : null,
      notify_applicants: false,
      application_status_unchanged: true,
    },
    request,
  });

  return NextResponse.json({
    success: true,
    updated: plan.changing.length,
    skipped: plan.skipped,
    unchanged: plan.apply.filter((row) => row.unchanged).length,
    batch_name: interviewSlot?.batch_name || null,
    moved: allowMove,
    notify_applicants: false,
  });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to update interview allocations",
        code: "ALLOCATION_SAVE_FAILED",
      },
      { status: 500 }
    );
  }
}
