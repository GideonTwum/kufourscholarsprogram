/**
 * Director-controlled internal interview allocation (planning).
 * Independent of applications.status / Stage 2 approval.
 * Does not write interview_slots or send notifications.
 * Physical dates come from interview_schedule_days — never hardcoded.
 */

import { fetchAllApplicationPages, fetchAllRowsForIds } from "./director-application-scope.js";
import {
  STUDY_LOCATION_UNCONFIRMED_LABEL,
  filterByDirectorLocationConfirmation,
  filterByDirectorStudyInstitution,
  filterByDirectorStudyRegion,
  filterByDirectorStudyTown,
  hasLocationConfirmation,
  normalizeDirectorInstitutionParam,
  normalizeDirectorLocationParam,
  normalizeDirectorRegionParam,
  normalizeDirectorTownParam,
  studyInstitutionDisplay,
  studyInstitutionKey,
  studyRegionKey,
  studyRegionLabel,
  studyTownDisplay,
  studyTownKey,
  virtualEligibilityForStudyRegion,
} from "./director-location-filter.js";
import {
  findScheduleDay,
  formatInterviewDayLabel,
  formatInterviewWindowLabel,
  isActiveInterviewScheduleDay,
  normalizeInterviewDate,
} from "./director-interview-schedule.js";
import { classifyDirectorStage2Review } from "./director-stage2-review.js";
import { fetchInterviewLocationConfirmationsMap } from "./director-interview-location.js";
import { mapAssignmentRpcResult } from "./director-interview-capacity.js";
import {
  duplicateAssignmentConflict,
  formatAssignedBatchLabel,
} from "./director-interview-assignment.js";

export const INTERVIEW_ALLOCATION_STATES = Object.freeze({
  unallocated: "unallocated",
  physical: "physical",
  pending_remote: "pending_remote",
});

export const INTERVIEW_ALLOCATION_LABELS = Object.freeze({
  unallocated: "Unallocated",
  physical: "Physical Interview Allocated",
  pending_remote: "Pending Remote Arrangement",
});

export const INTERVIEW_ALLOCATION_BADGE = Object.freeze({
  unallocated: { label: "Unallocated", color: "bg-gray-100 text-gray-600" },
  physical: { label: "Physical Interview Allocated", color: "bg-green-50 text-green-700" },
  pending_remote: { label: "Pending Remote Arrangement", color: "bg-amber-50 text-amber-800" },
});

export const INTERVIEW_ALLOCATION_FILTERS = Object.freeze([
  { key: "", label: "All allocations" },
  { key: "unallocated", label: "Unallocated" },
  { key: "physical", label: "Physical Interview Allocated" },
  { key: "pending_remote", label: "Pending Remote Arrangement" },
]);

export const INTERVIEW_ALLOCATION_ACTIONS = Object.freeze([
  "allocate_physical",
  "allocate_batch",
  "pending_remote",
  "unallocate",
]);

export const INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES = Object.freeze([
  "stage_2_approved",
  "interview_review_pending",
]);

export const INTERVIEW_ALLOCATION_TABLE = "application_interview_allocations";

export const INTERVIEW_ALLOCATION_SELECT =
  "id, application_id, schedule_id, allocation_state, schedule_day_id, interview_slot_id, appointment_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, invitation_delivery_status, invitation_last_error, response_status, allocated_by, created_at, updated_at";

export const INTERVIEW_ALLOCATION_SELECT_NO_DELIVERY =
  "id, application_id, schedule_id, allocation_state, schedule_day_id, interview_slot_id, appointment_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, response_status, allocated_by, created_at, updated_at";

export const INTERVIEW_ALLOCATION_SELECT_LEGACY =
  "id, application_id, schedule_id, allocation_state, schedule_day_id, published_at, allocated_by, created_at, updated_at";

export const MAX_INTERVIEW_ALLOCATION_BATCH = 500;

const ELIGIBLE_SET = new Set(INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES);

export function normalizeDirectorAllocationParam(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key === "all") return "";
  if (INTERVIEW_ALLOCATION_FILTERS.some((f) => f.key === key)) return key;
  return "";
}

export function normalizeDirectorInterviewDateParam(raw, days = []) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) return "";
  const day = findScheduleDay(days, key);
  if (day) return normalizeInterviewDate(day.interview_date) || day.id;
  return normalizeInterviewDate(key);
}

export function classifyInterviewAllocation(allocation) {
  const state = allocation?.allocation_state;
  if (state === INTERVIEW_ALLOCATION_STATES.physical) return INTERVIEW_ALLOCATION_STATES.physical;
  if (state === INTERVIEW_ALLOCATION_STATES.pending_remote) {
    return INTERVIEW_ALLOCATION_STATES.pending_remote;
  }
  return INTERVIEW_ALLOCATION_STATES.unallocated;
}

export function interviewAllocationDayOf(allocation, days = []) {
  if (classifyInterviewAllocation(allocation) !== INTERVIEW_ALLOCATION_STATES.physical) {
    return null;
  }
  if (allocation?.day) return allocation.day;
  return findScheduleDay(days, allocation?.schedule_day_id);
}

export function interviewAllocationDateOf(allocation, days = []) {
  const day = interviewAllocationDayOf(allocation, days);
  return normalizeInterviewDate(day?.interview_date);
}

export function isEligibleForInterviewAllocation(app) {
  if (!app || !ELIGIBLE_SET.has(app.status)) return false;
  if (app.interview_slot_id) return false;
  return true;
}

export function ineligibilityReason(app) {
  if (!app) return "missing_application";
  if (app.interview_slot_id) return "already_on_published_batch";
  if (!ELIGIBLE_SET.has(app.status)) return "ineligible_status";
  return null;
}

export function emptyInterviewAllocationCounts(days = []) {
  return {
    eligible: 0,
    physical: 0,
    pending_remote: 0,
    unallocated: 0,
    missing_region: 0,
    unconfirmed_location: 0,
    scheduled: 0,
    unscheduled: 0,
    virtual_approved: 0,
    attendance_confirmed: 0,
    pending_requests: 0,
    by_date: (days || []).map((day) => ({
      day_id: day.id,
      date: normalizeInterviewDate(day.interview_date),
      label: formatInterviewDayLabel(day.interview_date, day.start_time, day.end_time),
      start_time: day.start_time,
      end_time: day.end_time,
      is_active: day.is_active !== false,
      count: 0,
    })),
  };
}

export function summarizeInterviewAllocationCounts(rows, days = []) {
  const counts = emptyInterviewAllocationCounts(days);
  const byDayId = new Map(counts.by_date.map((item) => [item.day_id, item]));
  const byDate = new Map(counts.by_date.map((item) => [item.date, item]));
  for (const row of rows || []) {
    const app = row?.app ?? row;
    if (!isEligibleForInterviewAllocation(app)) continue;
    counts.eligible += 1;
    if (studyRegionKey(row) === "unknown") counts.missing_region += 1;
    if (!hasLocationConfirmation(row)) counts.unconfirmed_location += 1;
    const state = classifyInterviewAllocation(row?.allocation);
    if (state === INTERVIEW_ALLOCATION_STATES.physical) {
      counts.physical += 1;
      const day = interviewAllocationDayOf(row.allocation, days);
      const bucket = (day && byDayId.get(day.id)) || byDate.get(interviewAllocationDateOf(row.allocation, days));
      if (bucket) bucket.count += 1;
      if (row?.allocation?.interview_slot_id || row?.allocation?.appointment_id) counts.scheduled += 1;
      else counts.unscheduled += 1;
      if (row?.allocation?.interview_format === "virtual") counts.virtual_approved += 1;
    } else if (state === INTERVIEW_ALLOCATION_STATES.pending_remote) {
      counts.pending_remote += 1;
      counts.unscheduled += 1;
    } else {
      counts.unallocated += 1;
      counts.unscheduled += 1;
    }
    if (row?.allocation?.response_status === "attendance_confirmed") counts.attendance_confirmed += 1;
    if (
      row?.allocation?.response_status === "virtual_requested" ||
      row?.allocation?.response_status === "reschedule_requested" ||
      row?.allocation?.response_status === "unable_to_attend"
    ) {
      counts.pending_requests += 1;
    }
  }
  return counts;
}

export function filterByDirectorInterviewAllocation(rows, allocationFilter, dateFilter, days = []) {
  const list = Array.isArray(rows) ? rows : [];
  const allocKey = normalizeDirectorAllocationParam(allocationFilter);
  const dateKey = typeof dateFilter === "string" ? dateFilter.trim() : "";
  if (!allocKey && !dateKey) return list;
  const targetDay = dateKey ? findScheduleDay(days, dateKey) : null;
  const targetDate = targetDay ? normalizeInterviewDate(targetDay.interview_date) : normalizeInterviewDate(dateKey);
  return list.filter((row) => {
    const state = classifyInterviewAllocation(row?.allocation);
    if (allocKey && state !== allocKey) return false;
    if (dateKey) {
      if (state !== INTERVIEW_ALLOCATION_STATES.physical) return false;
      const day = interviewAllocationDayOf(row.allocation, days);
      if (targetDay && day?.id === targetDay.id) return true;
      return interviewAllocationDateOf(row.allocation, days) === targetDate;
    }
    return true;
  });
}

export function filterInterviewAllocationRows(rows, filters = {}, days = []) {
  let list = Array.isArray(rows) ? rows : [];
  const region = normalizeDirectorRegionParam(filters.region);
  const town = normalizeDirectorTownParam(filters.town);
  const loc = normalizeDirectorLocationParam(filters.loc);
  const institution = normalizeDirectorInstitutionParam(filters.institution);
  if (region) list = filterByDirectorStudyRegion(list, region);
  if (town) list = filterByDirectorStudyTown(list, town);
  if (institution) list = filterByDirectorStudyInstitution(list, institution);
  if (loc) list = filterByDirectorLocationConfirmation(list, loc);
  if (filters.stage2 === "approved") {
    list = list.filter((row) => (row?.app ?? row)?.status === "stage_2_approved");
  } else if (filters.stage2 === "queue") {
    list = list.filter((row) => (row?.app ?? row)?.status === "interview_review_pending");
  }
  list = filterByDirectorInterviewAllocation(list, filters.alloc, filters.idate, days);
  return list;
}

export function stage2StatusLabelForAllocation(app) {
  const review = classifyDirectorStage2Review(app);
  if (review === "approved") return "Stage 2 Approved";
  if (app?.status === "interview_review_pending") return "Interview queue";
  if (review === "pending") return "Stage 2 Pending Review";
  return app?.status || "Unknown";
}

export function presentInterviewAllocationRow(row, days = [], extras = {}) {
  const app = row?.app ?? row;
  const allocation = row?.allocation || null;
  const state = classifyInterviewAllocation(allocation);
  const day = interviewAllocationDayOf(allocation, days);
  const date = interviewAllocationDateOf(allocation, days);
  const confirmed = hasLocationConfirmation(row);
  const studyRegion = studyRegionKey(row);
  const eligibility = virtualEligibilityForStudyRegion(
    studyRegion === "unknown" ? "" : studyRegion,
    extras.virtualEligibleRegions
  );
  return {
    id: app?.id,
    full_name: app?.profiles?.full_name || app?.full_name || "Unknown",
    email: app?.profiles?.email || app?.email || null,
    university: app?.university || null,
    status: app?.status || null,
    stage2_label: stage2StatusLabelForAllocation(app),
    region: confirmed ? studyRegionLabel(row) : STUDY_LOCATION_UNCONFIRMED_LABEL,
    region_key: studyRegion,
    effective_region: studyRegionLabel(row),
    effective_region_key: studyRegion,
    town: studyTownDisplay(row),
    town_key: studyTownKey(row),
    location_confirmed: confirmed,
    location_label: confirmed ? "Study location confirmed" : STUDY_LOCATION_UNCONFIRMED_LABEL,
    confirmed_region: row?.location_confirmation?.confirmed_region || row?.location_confirmation?.study_region || null,
    confirmed_town: row?.location_confirmation?.confirmed_town || null,
    location_source: row?.location_confirmation?.source || null,
    study_institution: confirmed
      ? studyInstitutionDisplay(row)
      : STUDY_LOCATION_UNCONFIRMED_LABEL,
    study_institution_key: studyInstitutionKey(row),
    study_institution_prefill: app?.university || null,
    study_region: confirmed ? studyRegionLabel(row) : null,
    virtual_eligibility: eligibility,
    appointment_id: null,
    interview_slot_id: allocation?.interview_slot_id || null,
    batch_label: allocation?.slot
      ? formatInterviewWindowLabel(allocation.slot.interview_time || allocation.slot.start_time, allocation.slot.end_time)
      : null,
    appointment_label: allocation?.slot
      ? formatInterviewWindowLabel(allocation.slot.interview_time || allocation.slot.start_time, allocation.slot.end_time)
      : null,
    appointment_start: allocation?.slot?.interview_time || allocation?.slot?.start_time || null,
    interview_format: row?.allocation?.interview_format || "in_person",
    response_status: row?.allocation?.response_status || null,
    invitation_sent_at: row?.allocation?.invitation_sent_at || null,
    invitation_delivery_status: row?.allocation?.invitation_delivery_status || null,
    invitation_last_error: row?.allocation?.invitation_last_error || null,
    meeting_link: row?.allocation?.meeting_link || null,
    allocation_state: state,
    allocation_label: INTERVIEW_ALLOCATION_LABELS[state],
    schedule_day_id: day?.id || null,
    interview_date: date,
    interview_date_label: day
      ? formatInterviewDayLabel(day.interview_date, day.start_time, day.end_time)
      : null,
    published_at: allocation?.published_at || null,
  };
}

function uniqueIds(ids) {
  const out = [];
  const seen = new Set();
  for (const id of ids || []) {
    if (id == null || id === "") continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function snapshotAllocation(allocation, days = []) {
  if (!allocation) {
    return {
      allocation_state: INTERVIEW_ALLOCATION_STATES.unallocated,
      schedule_day_id: null,
      interview_date: null,
      interview_slot_id: null,
    };
  }
  const day = interviewAllocationDayOf(allocation, days);
  return {
    allocation_state: classifyInterviewAllocation(allocation),
    schedule_day_id: day?.id || allocation.schedule_day_id || null,
    interview_date: interviewAllocationDateOf(allocation, days),
    interview_slot_id: allocation.interview_slot_id || null,
  };
}

export function planDirectorInterviewAllocations({
  applications,
  allocationsById = {},
  selectedIds,
  action,
  scheduleDay = null,
  scheduleDayId = null,
  days = [],
  assignments = [],
  interviewFormat = "in_person",
  interviewSlot = null,
  allowMove = false,
  slotsById = {},
} = {}) {
  const ids = uniqueIds(selectedIds);
  const skipped = [];
  const apply = [];
  const errors = [];

  if (!INTERVIEW_ALLOCATION_ACTIONS.includes(action)) {
    return {
      ok: false,
      error: "invalid_action",
      apply: [],
      skipped: [],
      errors: [{ reason: "invalid_action" }],
    };
  }

  if (ids.length === 0) {
    return { ok: false, error: "no_selection", apply: [], skipped: [], errors: [{ reason: "no_selection" }] };
  }

  if (ids.length > MAX_INTERVIEW_ALLOCATION_BATCH) {
    return {
      ok: false,
      error: "batch_too_large",
      apply: [],
      skipped: [],
      errors: [{ reason: "batch_too_large", max: MAX_INTERVIEW_ALLOCATION_BATCH }],
    };
  }

  let nextDay = null;
  if (action === "allocate_physical") {
    nextDay = scheduleDay || findScheduleDay(days, scheduleDayId);
    if (!nextDay) {
      return {
        ok: false,
        error: "invalid_interview_date",
        apply: [],
        skipped: [],
        errors: [{ reason: "invalid_interview_date" }],
      };
    }
    if (!isActiveInterviewScheduleDay(nextDay)) {
      return {
        ok: false,
        error: "inactive_interview_date",
        apply: [],
        skipped: [],
        errors: [{ reason: "inactive_interview_date", dayId: nextDay.id }],
      };
    }
  }
  if (action === "allocate_batch") {
    if (!interviewSlot?.id) {
      return {
        ok: false,
        error: "missing_batch",
        apply: [],
        skipped: [],
        errors: [{ reason: "missing_batch" }],
      };
    }
    nextDay =
      scheduleDay ||
      findScheduleDay(days, scheduleDayId || interviewSlot.schedule_day_id || interviewSlot.interview_date) || {
        id: interviewSlot.schedule_day_id || null,
        interview_date: interviewSlot.interview_date || null,
        schedule_id: interviewSlot.schedule_id || null,
        is_active: true,
      };
  }

  const appsById = new Map((applications || []).map((app) => [app.id, app]));
  const assignmentById = new Map(
    (assignments || []).map((item) => [String(item.application_id), item])
  );

  for (const id of ids) {
    const app = appsById.get(id);
    if (!app) {
      skipped.push({ id, reason: "not_found" });
      continue;
    }
    const reason = ineligibilityReason(app);
    if (reason) {
      skipped.push({ id, reason, status: app.status });
      continue;
    }

    const previous = snapshotAllocation(allocationsById[id], days);
    const existing = allocationsById[id];
    if ((action === "unallocate" || action === "allocate_batch") && existing?.published_at) {
      skipped.push({ id, reason: "published_locked" });
      continue;
    }
    if (action === "allocate_batch") {
      const conflict = duplicateAssignmentConflict({
        application: app,
        allocation: existing,
        destinationSlotId: interviewSlot?.id,
        allowMove,
        slotsById,
      });
      if (conflict) {
        skipped.push({
          id,
          reason: conflict.reason,
          assigned_slot_id: conflict.assigned_slot_id,
          assigned_batch_label: conflict.assigned_batch_label,
        });
        continue;
      }
    }

    let nextState = INTERVIEW_ALLOCATION_STATES.unallocated;
    let nextDayId = null;
    let nextDate = null;
    let nextSlotId = null;
    if (action === "allocate_physical" || action === "allocate_batch") {
      nextState = INTERVIEW_ALLOCATION_STATES.physical;
      nextDayId = nextDay.id;
      nextDate = normalizeInterviewDate(nextDay.interview_date);
    } else if (action === "pending_remote") {
      nextState = INTERVIEW_ALLOCATION_STATES.pending_remote;
    }
    if (action === "allocate_batch") {
      const assigned = assignmentById.get(id);
      const slotId = assigned?.interview_slot_id || interviewSlot?.id;
      if (!slotId) {
        skipped.push({ id, reason: "missing_batch" });
        continue;
      }
      nextSlotId = slotId;
    }

    apply.push({
      id,
      previous,
      previous_batch_label: formatAssignedBatchLabel(slotsById[previous.interview_slot_id]),
      next: {
        allocation_state: nextState,
        schedule_day_id: nextDayId,
        interview_date: nextDate,
        interview_slot_id: nextSlotId,
        appointment_id: null,
        interview_format: action === "pending_remote" ? "in_person" : interviewFormat,
        schedule_id: nextDay?.schedule_id || allocationsById[id]?.schedule_id || null,
      },
      next_batch_label: formatAssignedBatchLabel(interviewSlot || slotsById[nextSlotId]),
      unchanged:
        previous.allocation_state === nextState &&
        previous.schedule_day_id === nextDayId &&
        (existing?.interview_slot_id || null) === nextSlotId,
    });
  }

  const changing = apply.filter((row) => !row.unchanged);

  return {
    ok: true,
    action,
    apply,
    changing,
    skipped,
    errors,
    preserveApplicationStatus: true,
    notifyApplicants: false,
    publish: false,
  };
}

export function allocationRowForUpsert(applicationId, next, actorId) {
  const now = new Date().toISOString();
  const row = {
    application_id: applicationId,
    schedule_id: next.schedule_id || null,
    allocation_state: next.allocation_state,
    schedule_day_id: next.schedule_day_id,
    interview_slot_id: next.interview_slot_id || null,
    appointment_id: next.appointment_id || null,
    interview_format: next.interview_format || "in_person",
    allocated_by: actorId || null,
    updated_at: now,
  };
  if (next.meeting_link !== undefined) row.meeting_link = next.meeting_link;
  if (next.meeting_instructions !== undefined) row.meeting_instructions = next.meeting_instructions;
  if (!next.keep_published) {
    row.published_at = null;
    row.invitation_sent_at = null;
    row.response_status = null;
  }
  return row;
}

export async function fetchEligibleInterviewAllocationApplications(client) {
  const withTown = await fetchAllApplicationPages(() =>
    client
      .from("applications")
      .select(
        "id, status, region, current_town, interview_slot_id, stage_2_approved_at, stage_2_submitted_at, video_youtube_url"
      )
      .in("status", INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES)
  );
  const result = withTown.error
    ? await fetchAllApplicationPages(() =>
        client
          .from("applications")
          .select(
            "id, status, region, interview_slot_id, stage_2_approved_at, stage_2_submitted_at, video_youtube_url"
          )
          .in("status", INTERVIEW_ALLOCATION_ELIGIBLE_STATUSES)
      )
    : withTown;
  if (result.error) return { applications: [], error: result.error };
  return {
    applications: (result.data || []).filter(isEligibleForInterviewAllocation),
    error: null,
  };
}

export async function fetchInterviewAllocationsMap(client, applicationIds) {
  const ids = uniqueIds(applicationIds);
  if (!ids.length) return {};
  let { data, error } = await fetchAllRowsForIds(
    (chunkIds) =>
      client
        .from(INTERVIEW_ALLOCATION_TABLE)
        .select(INTERVIEW_ALLOCATION_SELECT)
        .in("application_id", chunkIds),
    ids
  );
  if (error) {
    const mid = await fetchAllRowsForIds(
      (chunkIds) =>
        client
          .from(INTERVIEW_ALLOCATION_TABLE)
          .select(INTERVIEW_ALLOCATION_SELECT_NO_DELIVERY)
          .in("application_id", chunkIds),
      ids
    );
    data = mid.data;
    error = mid.error;
  }
  if (error) {
    const fallback = await fetchAllRowsForIds(
      (chunkIds) =>
        client
          .from(INTERVIEW_ALLOCATION_TABLE)
          .select(INTERVIEW_ALLOCATION_SELECT_LEGACY)
          .in("application_id", chunkIds),
      ids
    );
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return { __error: error };
  const map = {};
  for (const row of data || []) {
    if (row?.application_id) map[row.application_id] = row;
  }
  return map;
}

export function attachScheduleDaysToAllocations(allocationsById, days = []) {
  const byId = new Map((days || []).map((d) => [d.id, d]));
  const out = {};
  for (const [appId, allocation] of Object.entries(allocationsById || {})) {
    if (appId === "__error") continue;
    out[appId] = {
      ...allocation,
      day: byId.get(allocation?.schedule_day_id) || null,
    };
  }
  return out;
}

export async function fetchInterviewAllocationDashboardCounts(client, days = []) {
  const empty = emptyInterviewAllocationCounts(days);
  try {
    const { applications, error } = await fetchEligibleInterviewAllocationApplications(client);
    if (error) return empty;
    const applicationIds = applications.map((app) => app.id);
    const allocationsById = await fetchInterviewAllocationsMap(client, applicationIds);
    if (allocationsById.__error) return empty;
    const withDays = attachScheduleDaysToAllocations(allocationsById, days);
    const confirmationsById = await fetchInterviewLocationConfirmationsMap(client, applicationIds);
    if (confirmationsById.__error) {
      /* table may not exist yet; counts still work without confirmations */
    }
    const confirmations = confirmationsById.__error ? {} : confirmationsById;
    const rows = applications.map((app) => ({
      app,
      allocation: withDays[app.id] || null,
      location_confirmation: confirmations[app.id] || null,
    }));
    return summarizeInterviewAllocationCounts(rows, days);
  } catch {
    return empty;
  }
}

export async function persistDirectorInterviewAllocations(client, { plan, actorId, interviewSlot = null }) {
  if (!plan?.ok) return { error: plan?.error || "invalid_plan" };

  if (plan.action === "allocate_batch") {
    const slotId = interviewSlot?.id || plan.changing?.[0]?.next?.interview_slot_id;
    const ids = (plan.changing || []).map((row) => row.id);
    const { data, error } = await client.rpc("assign_interview_batch_applicants", {
      p_slot_id: slotId,
      p_application_ids: ids,
      p_actor_id: actorId || null,
      p_interview_format: plan.changing?.[0]?.next?.interview_format || "in_person",
    });
    const mapped = mapAssignmentRpcResult(data, error);
    if (!mapped.ok) {
      return {
        error: mapped.error,
        status: mapped.status,
        available: mapped.available,
        needed: mapped.needed,
        skipped: mapped.skipped,
      };
    }
    return { error: null, upserted: mapped.assigned || ids.length, deleted: 0, locked: true };
  }

  const upserts = [];
  const deleteIds = [];
  for (const row of plan.changing || []) {
    if (row.next.allocation_state === INTERVIEW_ALLOCATION_STATES.unallocated) {
      deleteIds.push(row.id);
    } else {
      upserts.push(allocationRowForUpsert(row.id, row.next, actorId));
    }
  }

  if (upserts.length) {
    const { error } = await client
      .from(INTERVIEW_ALLOCATION_TABLE)
      .upsert(upserts, { onConflict: "application_id" });
    if (error) return { error: error.message || "upsert_failed" };
  }

  if (deleteIds.length) {
    const { error } = await client
      .from(INTERVIEW_ALLOCATION_TABLE)
      .delete()
      .in("application_id", deleteIds);
    if (error) return { error: error.message || "delete_failed" };
  }

  return { error: null, upserted: upserts.length, deleted: deleteIds.length };
}

export function confirmInterviewAllocationPreview(plan, days = [], extras = {}) {
  const changing = plan?.changing || [];
  const action = plan?.action;
  let title = "Confirm allocation change";
  let window = "";
  if (action === "allocate_physical") {
    const next = changing[0]?.next;
    const day = findScheduleDay(days, next?.schedule_day_id) || {
      interview_date: next?.interview_date,
    };
    title = `Allocate ${changing.length} applicant${changing.length === 1 ? "" : "s"} to ${formatInterviewDayLabel(day.interview_date, day.start_time, day.end_time)}`;
    window = formatInterviewWindowLabel(day.start_time, day.end_time);
  } else if (action === "allocate_batch") {
    title = `Assign ${changing.length} applicant${changing.length === 1 ? "" : "s"} to an interview batch`;
  } else if (action === "pending_remote") {
    title = `Mark ${changing.length} applicant${changing.length === 1 ? "" : "s"} as Pending Remote Arrangement`;
  } else if (action === "unallocate") {
    title = `Return ${changing.length} applicant${changing.length === 1 ? "" : "s"} to Unallocated`;
  }
  const namesById = extras.namesById || {};
  const assignmentById = new Map(
    (extras.assignments || []).map((row) => [String(row.application_id), row])
  );
  const items = changing.slice(0, 50).map((row) => {
    const assigned = assignmentById.get(String(row.id));
    const day = findScheduleDay(days, row.next?.schedule_day_id);
    return {
      id: row.id,
      name: namesById[row.id] || row.id,
      date: day ? formatInterviewDayLabel(day.interview_date, day.start_time, day.end_time) : row.next?.interview_date,
      time: assigned ? formatInterviewWindowLabel(assigned.start_time, assigned.end_time) : null,
    };
  });
  return {
    title,
    count: changing.length,
    skipped: plan?.skipped?.length || 0,
    unchanged: (plan?.apply || []).filter((row) => row.unchanged).length,
    window,
    items,
    notifyApplicants: false,
  };
}
