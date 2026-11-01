/**
 * Live interview request table — confirmed present in production:
 * public.application_interview_requests
 */

export const INTERVIEW_REQUESTS_TABLE = "application_interview_requests";

export const LIVE_INTERVIEW_TABLES = Object.freeze({
  schedules: "interview_schedules",
  schedule_days: "interview_schedule_days",
  allocations: "application_interview_allocations",
  location_confirmations: "application_interview_location_confirmations",
  interview_requests: INTERVIEW_REQUESTS_TABLE,
  appointments: "interview_appointments",
});

const CORE_COLUMNS =
  "id, application_id, request_type, reason, status, current_appointment_id, replacement_appointment_id, created_at, decided_at, director_notes";

const HARDENING_COLUMNS =
  "current_interview_slot_id, replacement_interview_slot_id, previous_interview_date, previous_interview_time, new_interview_date, new_interview_time, notification_status, notification_sent_at, notification_last_error";

const APPLICATIONS_EMBED_FK =
  "applications!application_interview_requests_application_id_fkey(full_name, status, interview_slot_id)";
const APPLICATIONS_EMBED = "applications(full_name, status, interview_slot_id)";

export const INTERVIEW_REQUEST_SELECTS = [
  `${CORE_COLUMNS}, ${HARDENING_COLUMNS}, ${APPLICATIONS_EMBED_FK}`,
  `${CORE_COLUMNS}, ${APPLICATIONS_EMBED_FK}`,
  `${CORE_COLUMNS}, ${APPLICATIONS_EMBED}`,
  CORE_COLUMNS,
];

export function classifyInterviewRequestQueryError(error) {
  const text = `${error?.code || ""} ${error?.message || error || ""}`;
  if (/PGRST205|42P01|does not exist|Could not find the table|schema cache.*table/i.test(text)) {
    return "missing_table";
  }
  if (/PGRST200|Could not find a relationship|relationship between/i.test(text)) {
    return "missing_relationship";
  }
  if (/PGRST204|42703|column .* does not exist|Could not find the .* column/i.test(text)) {
    return "missing_column";
  }
  return "query_failed";
}

export async function fetchDirectorInterviewRequests(admin, { limit = 200 } = {}) {
  let lastError = null;
  let lastKind = null;
  let lastSelect = null;
  for (const select of INTERVIEW_REQUEST_SELECTS) {
    const { data, error } = await admin
      .from(INTERVIEW_REQUESTS_TABLE)
      .select(select)
      .order("created_at", { ascending: false })
      .limit(limit);
    lastSelect = select;
    if (!error) {
      return { data: data || [], error: null, kind: null, select };
    }
    lastError = error;
    lastKind = classifyInterviewRequestQueryError(error);
    if (lastKind === "missing_table") {
      return { data: [], error, kind: lastKind, select };
    }
  }
  return { data: [], error: lastError, kind: lastKind, select: lastSelect };
}
