/**
 * Clock-aligned interview batches for the existing interview_slots workflow.
 * Individual 6-minute appointments are not published.
 */

import {
  clockToMinutes,
  minutesToClock,
  normalizeInterviewClockTime,
  normalizeInterviewDate,
  formatInterviewDayLabel,
} from "./director-interview-schedule.js";
import {
  DEFAULT_APPOINTMENT_DURATION_MINUTES,
  normalizeAppointmentDuration,
  normalizeBreakPeriod,
  validateBreakWithinWindow,
} from "./director-interview-appointments.js";

export const DEFAULT_BATCH_MINUTES = 60;
export const INTERVIEW_SLOTS_TABLE = "interview_slots";

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function subtractBreaks(windowStart, windowEnd, breakRanges) {
  const pieces = [{ start: windowStart, end: windowEnd }];
  for (const br of breakRanges) {
    const next = [];
    for (const piece of pieces) {
      if (!rangesOverlap(piece.start, piece.end, br.start, br.end)) {
        next.push(piece);
        continue;
      }
      if (piece.start < br.start) next.push({ start: piece.start, end: Math.min(piece.end, br.start) });
      if (piece.end > br.end) next.push({ start: Math.max(piece.start, br.end), end: piece.end });
    }
    pieces.splice(0, pieces.length, ...next.filter((p) => p.end > p.start));
  }
  return pieces;
}

export function generateInterviewBatches({
  startTime,
  endTime,
  durationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES,
  breaks = [],
} = {}) {
  const start = clockToMinutes(startTime);
  const end = clockToMinutes(endTime);
  const duration = normalizeAppointmentDuration(durationMinutes, 0);
  if (start == null || end == null || duration < 1) {
    return { ok: false, error: "invalid_timetable", batches: [], capacity: 0 };
  }
  if (end <= start) {
    return { ok: false, error: "end_time_must_be_after_start", batches: [], capacity: 0 };
  }

  const breakRanges = [];
  for (const br of breaks || []) {
    const checked = validateBreakWithinWindow(br, startTime, endTime);
    if (!checked.ok) return { ok: false, error: checked.error, batches: [], capacity: 0 };
    breakRanges.push({
      start: clockToMinutes(checked.start_time),
      end: clockToMinutes(checked.end_time),
    });
  }
  breakRanges.sort((a, b) => a.start - b.start);

  const batches = [];
  const firstHour = Math.floor(start / 60) * 60;
  for (let hour = firstHour; hour < end; hour += DEFAULT_BATCH_MINUTES) {
    const windowStart = Math.max(hour, start);
    const windowEnd = Math.min(hour + DEFAULT_BATCH_MINUTES, end);
    if (windowEnd <= windowStart) continue;
    for (const fragment of subtractBreaks(windowStart, windowEnd, breakRanges)) {
      const minutes = fragment.end - fragment.start;
      const capacity = Math.floor(minutes / duration);
      if (capacity < 1) continue;
      batches.push({
        start_time: minutesToClock(fragment.start),
        end_time: minutesToClock(fragment.end),
        minutes,
        capacity,
        partial: minutes < DEFAULT_BATCH_MINUTES,
      });
    }
  }

  return {
    ok: true,
    batches,
    capacity: batches.reduce((sum, batch) => sum + batch.capacity, 0),
    duration_minutes: duration,
  };
}

export function batchKey(batch) {
  return `${normalizeInterviewClockTime(batch?.start_time)}-${normalizeInterviewClockTime(batch?.end_time)}`;
}

export function isInterviewSlotPublished(slot) {
  return Boolean(slot?.published_at || slot?.invitation_sent_at);
}

export function summarizeBatchOccupancy(slots = [], allocatedBySlotId = {}) {
  return (slots || []).map((slot) => {
    const booked = allocatedBySlotId[slot.id] || 0;
    const capacity = Number(slot.capacity) > 0 ? Number(slot.capacity) : 0;
    return {
      ...slot,
      booked,
      available: Math.max(0, capacity - booked),
      full: capacity > 0 && booked >= capacity,
      published: isInterviewSlotPublished(slot),
    };
  });
}

export function planBatchAssignments({
  selectedIds = [],
  slot = null,
  booked = 0,
} = {}) {
  const ids = [...new Set((selectedIds || []).map((id) => String(id || "")).filter(Boolean))];
  const capacity = Number(slot?.capacity) > 0 ? Number(slot.capacity) : 0;
  if (!slot?.id) return { ok: false, error: "missing_batch", assignments: [], shortfall: ids.length };
  if (!ids.length) return { ok: false, error: "no_selection", assignments: [], shortfall: 0 };
  const available = Math.max(0, capacity - booked);
  if (ids.length > available) {
    return {
      ok: false,
      error: "insufficient_batch_capacity",
      assignments: [],
      shortfall: ids.length - available,
      needed: ids.length,
      available,
      capacity,
      booked,
    };
  }
  return {
    ok: true,
    assignments: ids.map((application_id) => ({
      application_id,
      interview_slot_id: slot.id,
      start_time: slot.start_time || slot.interview_time,
      end_time: slot.end_time,
    })),
    available,
    notifyApplicants: false,
  };
}

export function formatBatchWindow(startTime, endTime) {
  const start = normalizeInterviewClockTime(startTime);
  const end = normalizeInterviewClockTime(endTime);
  if (!start) return String(startTime || "");
  return end ? `${start}–${end} GMT` : `${start} GMT`;
}

export function formatBatchLabel(date, startTime, endTime) {
  const day = formatInterviewDayLabel(date, startTime, endTime);
  return day || formatBatchWindow(startTime, endTime);
}

export function suggestedBatchName(date, startTime, endTime) {
  const iso = normalizeInterviewDate(date);
  const window = formatBatchWindow(startTime, endTime);
  if (!iso) return window || "Interview batch";
  const formatted = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatted} · ${window}`;
}

export function canRegenerateDraftSlot(slot, booked = 0) {
  if (!slot) return false;
  if (isInterviewSlotPublished(slot)) return false;
  if (booked > 0) return false;
  if ((slot.status || "scheduled") === "cancelled") return false;
  return true;
}

export function slotBatchKey(slot) {
  return batchKey({
    start_time: slot?.interview_time || slot?.start_time,
    end_time: slot?.end_time,
  });
}

export function partitionDraftBatchesForRegen(existingSlots = [], generatedBatches = [], bookedBySlot = {}) {
  const generatedByKey = new Map((generatedBatches || []).map((batch) => [batchKey(batch), batch]));
  const protectedRows = [];
  const deletableIds = [];
  const toUpdate = [];
  const claimedKeys = new Set();

  for (const slot of existingSlots || []) {
    const key = slotBatchKey(slot);
    const booked = bookedBySlot[slot.id] || 0;
    if (!canRegenerateDraftSlot(slot, booked)) {
      protectedRows.push(slot);
      claimedKeys.add(key);
      continue;
    }
    const generated = generatedByKey.get(key);
    if (generated) {
      claimedKeys.add(key);
      toUpdate.push({ slot, batch: generated });
    } else {
      deletableIds.push(slot.id);
    }
  }

  return {
    protectedRows,
    deletableIds,
    toUpdate,
    toInsert: (generatedBatches || []).filter((batch) => !claimedKeys.has(batchKey(batch))),
  };
}

export function occupancyFromRows(rows = []) {
  const booked = {};
  const seen = new Set();
  for (const row of rows || []) {
    const slotId = row?.interview_slot_id;
    const applicationId = row?.application_id || row?.id;
    if (!slotId || !applicationId) continue;
    const key = `${slotId}:${applicationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    booked[slotId] = (booked[slotId] || 0) + 1;
  }
  return booked;
}

export function applicationUpdateForPublishedBatch({ slot, schedule = {}, allocation = {} } = {}) {
  const virtual = allocation?.interview_format === "virtual";
  const venue = virtual
    ? "Virtual interview"
    : schedule.physical_venue || slot?.location || "";
  return {
    interview_slot_id: slot.id,
    status: "called_for_interview",
    interview_date: slot.interview_date,
    interview_time: formatBatchWindow(slot.interview_time || slot.start_time, slot.end_time),
    interview_location: venue,
    interview_instructions: virtual ? schedule.virtual_instructions || null : schedule.physical_instructions || null,
  };
}
