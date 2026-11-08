/**
 * Director "Copy Details" helpers.
 * Formats applicant fields already visible on the director detail view.
 * Does not read notes, scores, tokens, or credentials.
 */

import { formatAssignedBatchLabel } from "./director-interview-assignment.js";

export const DIRECTOR_COPY_FIELD_KEYS = Object.freeze([
  "full_name",
  "application_id",
  "email",
  "phone",
  "institution",
  "programme",
  "application_status",
  "interview_batch",
]);

/** Contact fields stay optional and unchecked by default. */
export const DIRECTOR_COPY_CONTACT_FIELDS = Object.freeze(["email", "phone"]);

export const DIRECTOR_COPY_DEFAULT_FIELDS = Object.freeze([
  "full_name",
  "application_id",
  "institution",
  "programme",
  "application_status",
  "interview_batch",
]);

export const DIRECTOR_COPY_FIELD_META = Object.freeze({
  full_name: { label: "Full name", contact: false },
  application_id: { label: "Application ID", contact: false },
  email: { label: "Email", contact: true },
  phone: { label: "Phone", contact: true },
  institution: { label: "Institution", contact: false },
  programme: { label: "Programme of study", contact: false },
  application_status: { label: "Application status", contact: false },
  interview_batch: { label: "Interview batch", contact: false },
});

const STATUS_LABELS = Object.freeze({
  draft: "Draft",
  stage_1_submitted: "Stage 1 submitted",
  pending: "Pending",
  review_pending: "Deferred (Stage 1)",
  stage_1_approved: "Stage 1 approved",
  stage_2_submitted: "Stage 2 submitted",
  stage_2_review_pending: "Deferred (Stage 2)",
  stage_2_approved: "Stage 2 approved",
  interview_review_pending: "Interview pending",
  called_for_interview: "Called for interview",
  interview: "Interview",
  accepted: "Accepted",
  rejected: "Rejected",
});

function textOrBlank(value) {
  if (value == null) return "";
  const text = String(value).trim();
  return text;
}

export function formatDirectorApplicationStatus(status) {
  const raw = textOrBlank(status);
  if (!raw) return "";
  return STATUS_LABELS[raw] || raw.replace(/_/g, " ");
}

/**
 * Resolve interview batch label from already-authorized application/slot data.
 * Does not invent a batch when none is assigned.
 */
export function resolveDirectorCopyInterviewBatch(application, allocation = null, slotsById = {}) {
  const slotId = allocation?.interview_slot_id || application?.interview_slot_id || null;
  if (slotId) {
    const slot = slotsById[slotId] || null;
    if (slot) return formatAssignedBatchLabel(slot);
  }
  // Legacy individual interview fields — only if present on the authorized view.
  const date = textOrBlank(application?.interview_date);
  const time = textOrBlank(application?.interview_time);
  if (date || time) {
    return [date, time].filter(Boolean).join(" · ");
  }
  return "";
}

/**
 * Build the allowlisted value map from the director applicant detail payload.
 */
export function buildDirectorCopyValues({
  application = {},
  email = "",
  interviewBatch = "",
  allocation = null,
  slotsById = {},
} = {}) {
  const batch =
    textOrBlank(interviewBatch) ||
    resolveDirectorCopyInterviewBatch(application, allocation, slotsById);
  return {
    full_name: textOrBlank(application.full_name),
    application_id: textOrBlank(application.id),
    email: textOrBlank(email || application.profiles?.email || application.email),
    phone: textOrBlank(application.phone),
    institution: textOrBlank(application.university),
    programme: textOrBlank(application.program),
    application_status: formatDirectorApplicationStatus(application.status),
    interview_batch: batch,
  };
}

export function normalizeDirectorCopySelection(selected = []) {
  const wanted = new Set(
    (Array.isArray(selected) ? selected : []).filter((key) => DIRECTOR_COPY_FIELD_KEYS.includes(key))
  );
  return DIRECTOR_COPY_FIELD_KEYS.filter((key) => wanted.has(key));
}

export function defaultDirectorCopySelection() {
  return [...DIRECTOR_COPY_DEFAULT_FIELDS];
}

/**
 * Readable plain text for WhatsApp, email, or internal messages.
 * Skips selected fields that have no available value.
 */
export function formatDirectorCopyText(values, selectedFields = DIRECTOR_COPY_DEFAULT_FIELDS) {
  const keys = normalizeDirectorCopySelection(selectedFields);
  const lines = ["Applicant details", ""];
  let included = 0;
  for (const key of keys) {
    const value = textOrBlank(values?.[key]);
    if (!value) continue;
    lines.push(`${DIRECTOR_COPY_FIELD_META[key].label}: ${value}`);
    included += 1;
  }
  if (!included) {
    return "Applicant details\n\nNo selected fields are available for this applicant.";
  }
  return lines.join("\n");
}

export function describeDirectorCopyAvailability(values) {
  const available = {};
  for (const key of DIRECTOR_COPY_FIELD_KEYS) {
    available[key] = Boolean(textOrBlank(values?.[key]));
  }
  return available;
}
