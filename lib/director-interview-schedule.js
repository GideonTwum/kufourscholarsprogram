/**
 * Configurable interview schedule (dates + daily windows).
 * Dates are database-backed — never hardcoded as system rules.
 */

export const INTERVIEW_SCHEDULE_TIMEZONE = "Africa/Accra";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeInterviewDate(raw) {
  if (typeof raw !== "string") return "";
  const key = raw.trim().slice(0, 10);
  return DATE_RE.test(key) ? key : "";
}

export function normalizeInterviewClockTime(raw) {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export function clockToMinutes(hhmm) {
  const t = normalizeInterviewClockTime(hhmm);
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToClock(total) {
  const n = Number(total);
  if (!Number.isInteger(n) || n < 0 || n >= 24 * 60) return "";
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatInterviewDayLabel(date, startTime, endTime) {
  const iso = normalizeInterviewDate(date);
  if (!iso) return "Interview date";
  const formatted = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = normalizeInterviewClockTime(startTime);
  const end = normalizeInterviewClockTime(endTime);
  if (start && end) return `${formatted} · ${start}–${end} GMT`;
  return formatted;
}

export function formatInterviewWindowLabel(startTime, endTime) {
  const start = normalizeInterviewClockTime(startTime);
  const end = normalizeInterviewClockTime(endTime);
  if (!start || !end) return "";
  return `${start}–${end} GMT`;
}

/**
 * @param {{
 *   interviewDate?: string,
 *   startTime?: string,
 *   endTime?: string,
 *   existingDates?: string[],
 *   excludeDate?: string|null,
 * }} input
 */
export function validateInterviewScheduleDay({
  interviewDate,
  startTime,
  endTime,
  existingDates = [],
  excludeDate = null,
} = {}) {
  const date = normalizeInterviewDate(interviewDate);
  if (!date) return { ok: false, error: "invalid_interview_date" };
  const start = normalizeInterviewClockTime(startTime);
  const end = normalizeInterviewClockTime(endTime);
  if (!start || !end) return { ok: false, error: "invalid_time" };
  if ((clockToMinutes(end) ?? 0) <= (clockToMinutes(start) ?? 0)) {
    return { ok: false, error: "end_time_must_be_after_start" };
  }
  const taken = new Set(
    (existingDates || []).map((d) => normalizeInterviewDate(d)).filter(Boolean)
  );
  const skip = normalizeInterviewDate(excludeDate);
  if (skip) taken.delete(skip);
  if (taken.has(date)) return { ok: false, error: "duplicate_interview_date" };
  return { ok: true, interview_date: date, start_time: start, end_time: end };
}

export function canDeleteInterviewScheduleDay(allocationCount) {
  const n = Number(allocationCount) || 0;
  if (n > 0) {
    return {
      ok: false,
      error: "date_has_allocations",
      allocationCount: n,
    };
  }
  return { ok: true };
}

export function isActiveInterviewScheduleDay(day) {
  return Boolean(day && day.id && day.is_active !== false && normalizeInterviewDate(day.interview_date));
}

export function findScheduleDay(days, dayIdOrDate) {
  const list = Array.isArray(days) ? days : [];
  const key = dayIdOrDate == null ? "" : String(dayIdOrDate).trim();
  if (!key) return null;
  return (
    list.find((d) => d.id === key) ||
    list.find((d) => normalizeInterviewDate(d.interview_date) === normalizeInterviewDate(key)) ||
    null
  );
}

export const INTERVIEW_SCHEDULE_TABLE = "interview_schedules";
export const INTERVIEW_SCHEDULE_DAYS_TABLE = "interview_schedule_days";

function presentDay(row) {
  if (!row) return null;
  const start = String(row.start_time || "").slice(0, 5);
  const end = String(row.end_time || "").slice(0, 5);
  return {
    id: row.id,
    schedule_id: row.schedule_id,
    interview_date: normalizeInterviewDate(row.interview_date),
    start_time: start,
    end_time: end,
    is_active: row.is_active !== false,
    label: formatInterviewDayLabel(row.interview_date, start, end),
    window_label: formatInterviewWindowLabel(start, end),
  };
}

export async function ensureInterviewSchedule(client, className) {
  const name = typeof className === "string" && className.trim() ? className.trim() : "Interview schedule";
  const { data: existing, error: loadErr } = await client
    .from(INTERVIEW_SCHEDULE_TABLE)
    .select(
      "id, class_name, name, timezone, is_active, appointment_duration_minutes, arrival_minutes, physical_venue, whatsapp_contact, physical_instructions, virtual_instructions, required_documents_physical, required_documents_virtual, policy_wording, reschedule_policy_wording, virtual_eligible_study_regions"
    )
    .eq("class_name", name)
    .maybeSingle();
  if (loadErr) {
    const fallback = await client
      .from(INTERVIEW_SCHEDULE_TABLE)
      .select("id, class_name, name, timezone, is_active")
      .eq("class_name", name)
      .maybeSingle();
    if (fallback.error) return { schedule: null, error: fallback.error };
    if (fallback.data) return { schedule: fallback.data, error: null };
  } else if (existing) {
    return { schedule: existing, error: null };
  }

  const { data: created, error: createErr } = await client
    .from(INTERVIEW_SCHEDULE_TABLE)
    .insert({
      class_name: name,
      name: `${name} interviews`,
      timezone: INTERVIEW_SCHEDULE_TIMEZONE,
      is_active: true,
    })
    .select(
      "id, class_name, name, timezone, is_active, appointment_duration_minutes, arrival_minutes, physical_venue, whatsapp_contact, physical_instructions, virtual_instructions, required_documents_physical, required_documents_virtual, policy_wording, reschedule_policy_wording, virtual_eligible_study_regions"
    )
    .maybeSingle();
  if (createErr) return { schedule: null, error: createErr };
  return { schedule: created, error: null };
}

export async function ensureInterviewDayForDate(client, className, interviewDate, extras = {}) {
  const date = normalizeInterviewDate(interviewDate);
  if (!date) return { day: null, schedule: null, error: { message: "invalid_interview_date" } };
  const { schedule, error } = await ensureInterviewSchedule(client, className);
  if (error || !schedule) return { day: null, schedule: null, error: error || { message: "schedule_unavailable" } };
  const { days } = await fetchInterviewScheduleDays(client, schedule.id);
  const existing = findScheduleDay(days, date);
  if (existing) return { day: existing, schedule, error: null };
  const start = normalizeInterviewClockTime(extras.startTime) || "08:00";
  const end = normalizeInterviewClockTime(extras.endTime) || "16:00";
  const { data, error: insertErr } = await client
    .from(INTERVIEW_SCHEDULE_DAYS_TABLE)
    .insert({
      schedule_id: schedule.id,
      interview_date: date,
      start_time: start,
      end_time: end,
      is_active: true,
    })
    .select("id, schedule_id, interview_date, start_time, end_time, is_active")
    .maybeSingle();
  if (insertErr) {
    const retry = await fetchInterviewScheduleDays(client, schedule.id);
    const day = findScheduleDay(retry.days, date);
    if (day) return { day, schedule, error: null };
    return { day: null, schedule, error: insertErr };
  }
  return { day: presentDay(data), schedule, error: null };
}

export async function fetchInterviewScheduleDays(client, scheduleId) {
  if (!scheduleId) return { days: [], error: null };
  const { data, error } = await client
    .from(INTERVIEW_SCHEDULE_DAYS_TABLE)
    .select("id, schedule_id, interview_date, start_time, end_time, is_active, created_at, updated_at")
    .eq("schedule_id", scheduleId)
    .order("interview_date", { ascending: true });
  if (error) return { days: [], error };
  return { days: (data || []).map(presentDay), error: null };
}

export async function countAllocationsForScheduleDay(client, dayId) {
  if (!dayId) return 0;
  const { count, error } = await client
    .from("application_interview_allocations")
    .select("id", { count: "exact", head: true })
    .eq("schedule_day_id", dayId)
    .eq("allocation_state", "physical");
  if (error) return 0;
  return count || 0;
}
