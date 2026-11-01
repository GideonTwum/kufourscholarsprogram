/**
 * Configurable single-panel interview appointments.
 * Duration, hours, and breaks come from the schedule — never hardcoded daily totals.
 */

import {
  clockToMinutes,
  minutesToClock,
  normalizeInterviewClockTime,
  normalizeInterviewDate,
} from "./director-interview-schedule.js";

export const INTERVIEW_APPOINTMENTS_TABLE = "interview_appointments";
export const INTERVIEW_SCHEDULE_BREAKS_TABLE = "interview_schedule_breaks";
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 6;
export const DEFAULT_ARRIVAL_MINUTES = 15;
export const INTERVIEW_FORMATS = Object.freeze({
  in_person: "in_person",
  virtual: "virtual",
});

export function normalizeAppointmentDuration(raw, fallback = DEFAULT_APPOINTMENT_DURATION_MINUTES) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 180) return fallback;
  return n;
}

export function normalizeBreakPeriod(raw) {
  const start = normalizeInterviewClockTime(raw?.start_time ?? raw?.startTime);
  const end = normalizeInterviewClockTime(raw?.end_time ?? raw?.endTime);
  if (!start || !end) return null;
  if ((clockToMinutes(end) ?? 0) <= (clockToMinutes(start) ?? 0)) return null;
  return { start_time: start, end_time: end };
}

export function validateBreakWithinWindow(breakPeriod, startTime, endTime) {
  const br = normalizeBreakPeriod(breakPeriod);
  const windowStart = clockToMinutes(startTime);
  const windowEnd = clockToMinutes(endTime);
  if (!br || windowStart == null || windowEnd == null) return { ok: false, error: "invalid_break" };
  const bStart = clockToMinutes(br.start_time);
  const bEnd = clockToMinutes(br.end_time);
  if (bStart < windowStart || bEnd > windowEnd) return { ok: false, error: "break_outside_window" };
  return { ok: true, ...br };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function appointmentsOverlap(a, b) {
  const aStart = clockToMinutes(a?.start_time);
  const aEnd = clockToMinutes(a?.end_time);
  const bStart = clockToMinutes(b?.start_time);
  const bEnd = clockToMinutes(b?.end_time);
  if ([aStart, aEnd, bStart, bEnd].some((v) => v == null)) return false;
  return rangesOverlap(aStart, aEnd, bStart, bEnd);
}

export function appointmentOverlapsBreaks(appointment, breaks = []) {
  const start = clockToMinutes(appointment?.start_time);
  const end = clockToMinutes(appointment?.end_time);
  if (start == null || end == null) return true;
  for (const br of breaks || []) {
    const normalized = normalizeBreakPeriod(br);
    if (!normalized) continue;
    if (rangesOverlap(start, end, clockToMinutes(normalized.start_time), clockToMinutes(normalized.end_time))) {
      return true;
    }
  }
  return false;
}

/**
 * Generate non-overlapping single-panel appointments for one day.
 */
export function generateInterviewAppointments({
  startTime,
  endTime,
  durationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES,
  breaks = [],
} = {}) {
  const start = clockToMinutes(startTime);
  const end = clockToMinutes(endTime);
  const duration = normalizeAppointmentDuration(durationMinutes, 0);
  if (start == null || end == null || duration < 1) {
    return { ok: false, error: "invalid_timetable", appointments: [], capacity: 0 };
  }
  if (end <= start) {
    return { ok: false, error: "end_time_must_be_after_start", appointments: [], capacity: 0 };
  }

  const breakRanges = [];
  for (const br of breaks || []) {
    const checked = validateBreakWithinWindow(br, startTime, endTime);
    if (!checked.ok) {
      return { ok: false, error: checked.error, appointments: [], capacity: 0 };
    }
    breakRanges.push({
      start: clockToMinutes(checked.start_time),
      end: clockToMinutes(checked.end_time),
      start_time: checked.start_time,
      end_time: checked.end_time,
    });
  }
  breakRanges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < breakRanges.length; i += 1) {
    if (rangesOverlap(breakRanges[i - 1].start, breakRanges[i - 1].end, breakRanges[i].start, breakRanges[i].end)) {
      return { ok: false, error: "overlapping_breaks", appointments: [], capacity: 0 };
    }
  }

  const appointments = [];
  let cursor = start;
  while (cursor + duration <= end) {
    const slotEnd = cursor + duration;
    const hit = breakRanges.find((br) => rangesOverlap(cursor, slotEnd, br.start, br.end));
    if (hit) {
      cursor = hit.end;
      continue;
    }
    appointments.push({
      start_time: minutesToClock(cursor),
      end_time: minutesToClock(slotEnd),
    });
    cursor = slotEnd;
  }

  return {
    ok: true,
    appointments,
    capacity: appointments.length,
    duration_minutes: duration,
  };
}

export function summarizeAppointmentCapacity(appointments = [], allocationsByAppointmentId = {}) {
  let booked = 0;
  let held = 0;
  let available = 0;
  let published = 0;
  for (const apt of appointments || []) {
    const allocation = allocationsByAppointmentId[apt.id];
    if (apt.is_held && !allocation) held += 1;
    else if (allocation?.published_at) {
      booked += 1;
      published += 1;
    } else if (allocation) booked += 1;
    else available += 1;
  }
  return {
    total: (appointments || []).length,
    booked,
    available,
    held,
    published,
  };
}

export function isAppointmentAssignable(appointment, allocationByAppointmentId = {}) {
  if (!appointment?.id) return false;
  if (appointment.is_held) return false;
  const taken = allocationByAppointmentId[appointment.id];
  return !taken;
}

export function nextAvailableAppointments(appointments = [], allocationByAppointmentId = {}, limit = Infinity) {
  const out = [];
  const sorted = [...(appointments || [])].sort((a, b) =>
    String(a.start_time || "").localeCompare(String(b.start_time || ""))
  );
  for (const apt of sorted) {
    if (!isAppointmentAssignable(apt, allocationByAppointmentId)) continue;
    out.push(apt);
    if (out.length >= limit) break;
  }
  return out;
}

export function planSequentialAppointmentAssignments({
  selectedIds = [],
  availableAppointments = [],
} = {}) {
  const ids = [...new Set((selectedIds || []).map((id) => String(id || "")).filter(Boolean))];
  if (!ids.length) return { ok: false, error: "no_selection", assignments: [], shortfall: 0 };
  const slots = Array.isArray(availableAppointments) ? availableAppointments : [];
  if (slots.length < ids.length) {
    return {
      ok: false,
      error: "insufficient_appointments",
      assignments: [],
      shortfall: ids.length - slots.length,
      needed: ids.length,
      available: slots.length,
    };
  }
  return {
    ok: true,
    assignments: ids.map((applicationId, index) => ({
      application_id: applicationId,
      appointment_id: slots[index].id,
      start_time: slots[index].start_time,
      end_time: slots[index].end_time,
      schedule_day_id: slots[index].schedule_day_id,
    })),
    shortfall: 0,
    notifyApplicants: false,
  };
}

export function canRegenerateAppointment(appointment, allocationByAppointmentId = {}) {
  if (!appointment) return false;
  const allocation = allocationByAppointmentId[appointment.id];
  if (allocation) return false;
  if (appointment.is_held) return false;
  return true;
}

export function partitionAppointmentsForRegen(existing = [], generated = [], allocationByAppointmentId = {}) {
  const protectedRows = [];
  const deletableIds = [];
  for (const apt of existing || []) {
    if (canRegenerateAppointment(apt, allocationByAppointmentId)) deletableIds.push(apt.id);
    else protectedRows.push(apt);
  }
  const protectedKeys = new Set(
    protectedRows.map(
      (apt) => `${normalizeInterviewClockTime(apt.start_time)}-${normalizeInterviewClockTime(apt.end_time)}`
    )
  );
  const toInsert = (generated || []).filter((apt) => {
    const key = `${normalizeInterviewClockTime(apt.start_time)}-${normalizeInterviewClockTime(apt.end_time)}`;
    return !protectedKeys.has(key);
  });
  return { protectedRows, deletableIds, toInsert };
}

export function formatAppointmentClock(startTime, endTime) {
  const start = normalizeInterviewClockTime(startTime);
  const end = normalizeInterviewClockTime(endTime);
  if (!start || !end) return "";
  return `${start}–${end} GMT`;
}

export function formatAppointmentLabel(date, startTime, endTime) {
  const iso = normalizeInterviewDate(date);
  const clock = formatAppointmentClock(startTime, endTime);
  if (!iso) return clock || "Appointment";
  const formatted = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return clock ? `${formatted} · ${clock}` : formatted;
}
