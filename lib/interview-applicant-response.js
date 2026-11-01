export const INTERVIEW_RESPONSE_STATUSES = Object.freeze({
  awaiting_response: "awaiting_response",
  attendance_confirmed: "attendance_confirmed",
  virtual_requested: "virtual_requested",
  reschedule_requested: "reschedule_requested",
  unable_to_attend: "unable_to_attend",
});

export const INTERVIEW_REQUEST_TYPES = Object.freeze({
  virtual: "virtual",
  reschedule: "reschedule",
  unable: "unable",
});

export const INTERVIEW_REQUEST_STATUSES = Object.freeze({
  pending: "pending",
  approved: "approved",
  declined: "declined",
});

const RESPONSE_SET = new Set(Object.values(INTERVIEW_RESPONSE_STATUSES));
const REQUEST_TYPE_SET = new Set(Object.values(INTERVIEW_REQUEST_TYPES));

export function normalizeInterviewResponseAction(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key === "confirm_attendance") return INTERVIEW_RESPONSE_STATUSES.attendance_confirmed;
  if (RESPONSE_SET.has(key)) return key;
  if (REQUEST_TYPE_SET.has(key)) return key;
  return "";
}

export function validateApplicantInterviewResponse({ action, reason } = {}) {
  const key = normalizeInterviewResponseAction(action);
  if (key === INTERVIEW_RESPONSE_STATUSES.attendance_confirmed) {
    return { ok: true, kind: "response", response_status: key, notifyApplicants: false };
  }
  if (key === INTERVIEW_RESPONSE_STATUSES.unable_to_attend || key === INTERVIEW_REQUEST_TYPES.unable) {
    const text = typeof reason === "string" ? reason.trim() : "";
    if (text.length < 8) return { ok: false, error: "reason_required" };
    return {
      ok: true,
      kind: "request",
      request_type: INTERVIEW_REQUEST_TYPES.unable,
      response_status: INTERVIEW_RESPONSE_STATUSES.unable_to_attend,
      reason: text.slice(0, 2000),
    };
  }
  if (key === INTERVIEW_REQUEST_TYPES.virtual || key === INTERVIEW_RESPONSE_STATUSES.virtual_requested) {
    const text = typeof reason === "string" ? reason.trim() : "";
    if (text.length < 8) return { ok: false, error: "reason_required" };
    return {
      ok: true,
      kind: "request",
      request_type: INTERVIEW_REQUEST_TYPES.virtual,
      response_status: INTERVIEW_RESPONSE_STATUSES.virtual_requested,
      reason: text.slice(0, 2000),
    };
  }
  if (key === INTERVIEW_REQUEST_TYPES.reschedule || key === INTERVIEW_RESPONSE_STATUSES.reschedule_requested) {
    const text = typeof reason === "string" ? reason.trim() : "";
    if (text.length < 8) return { ok: false, error: "reason_required" };
    return {
      ok: true,
      kind: "request",
      request_type: INTERVIEW_REQUEST_TYPES.reschedule,
      response_status: INTERVIEW_RESPONSE_STATUSES.reschedule_requested,
      reason: text.slice(0, 2000),
    };
  }
  return { ok: false, error: "invalid_response" };
}

export function requestDoesNotChangeAppointment() {
  return { autoApprove: false, releasesAppointment: false };
}

export function interviewModeLabel({ interviewFormat, responseStatus } = {}) {
  if (interviewFormat === "virtual") return "Virtual — Approved";
  if (responseStatus === INTERVIEW_RESPONSE_STATUSES.virtual_requested) return "Virtual — Requested";
  return "In-person";
}

export function interviewResponseLabel(status) {
  const key = typeof status === "string" ? status.trim() : "";
  if (key === INTERVIEW_RESPONSE_STATUSES.attendance_confirmed) return "Attendance Confirmed";
  if (key === INTERVIEW_RESPONSE_STATUSES.virtual_requested) return "Virtual Interview Requested";
  if (key === INTERVIEW_RESPONSE_STATUSES.reschedule_requested) return "Rescheduling Requested";
  if (key === INTERVIEW_RESPONSE_STATUSES.unable_to_attend) return "Unable to Attend";
  if (key === INTERVIEW_RESPONSE_STATUSES.awaiting_response) return "Awaiting Response";
  return "—";
}
