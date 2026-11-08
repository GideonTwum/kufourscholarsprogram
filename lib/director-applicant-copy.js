/**
 * Director "Copy Details" helpers.
 * Formats applicant fields already visible on the director detail view.
 * Does not read notes, scores, tokens, credentials, or private document URLs.
 */

import { ageInYearsOnDateOfBirth } from "./application-validation.js";
import { formatAssignedBatchLabel } from "./director-interview-assignment.js";

export const DIRECTOR_COPY_FIELD_KEYS = Object.freeze([
  "full_name",
  "application_id",
  "email",
  "phone",
  "institution",
  "programme",
  "level_of_study",
  "age",
  "academic_results",
  "application_status",
  "interview_batch",
]);

/** Contact fields stay optional and unchecked by default. */
export const DIRECTOR_COPY_CONTACT_FIELDS = Object.freeze(["email", "phone"]);

/** Extra optional fields — unchecked by default, not contact. */
export const DIRECTOR_COPY_EXTRA_OPTIONAL_FIELDS = Object.freeze([
  "level_of_study",
  "age",
  "academic_results",
]);

export const DIRECTOR_COPY_DEFAULT_FIELDS = Object.freeze([
  "full_name",
  "application_id",
  "institution",
  "programme",
  "application_status",
  "interview_batch",
]);

export const DIRECTOR_COPY_FIELD_META = Object.freeze({
  full_name: { label: "Full name", contact: false, optional: false },
  application_id: { label: "Application ID", contact: false, optional: false },
  email: { label: "Email", contact: true, optional: true },
  phone: { label: "Phone", contact: true, optional: true },
  institution: { label: "Institution", contact: false, optional: false },
  programme: { label: "Programme of study", contact: false, optional: false },
  level_of_study: { label: "Level of study", contact: false, optional: true },
  age: { label: "Age", contact: false, optional: true },
  academic_results: { label: "Academic results", contact: false, optional: true },
  application_status: { label: "Application status", contact: false, optional: false },
  interview_batch: { label: "Interview batch", contact: false, optional: false },
});

export const DIRECTOR_COPY_NOT_PROVIDED = "Not provided";

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

const SHOW_EMPTY_AS_NOT_PROVIDED = new Set(DIRECTOR_COPY_EXTRA_OPTIONAL_FIELDS);

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
 * Birthday-aware age from applications.date_of_birth.
 * Uses the current date (or injectable asOf). Does not use submission dates.
 * @param {string|null|undefined} dateOfBirth
 * @param {Date} [asOf]
 * @returns {string} age as digits, or "" when DOB is missing/invalid
 */
export function formatDirectorCopyAge(dateOfBirth, asOf = new Date()) {
  const age = ageInYearsOnDateOfBirth(dateOfBirth, asOf);
  if (age === null || age < 0) return "";
  return String(age);
}

/**
 * University academic results from recorded grade_type + gpa.
 * Does not invent WASSCE subject grades (those are document uploads only).
 * Never includes storage paths or document URLs.
 * @param {Record<string, unknown>} application
 * @returns {string}
 */
export function formatDirectorCopyAcademicResults(application = {}) {
  const parts = [];
  // Optional structured subject grades if ever present on the authorized payload.
  // Accept only plain subject/grade pairs; ignore paths and URLs.
  const structured =
    application.wassce_grades ||
    application.ssce_grades ||
    application.academic_subject_grades ||
    null;
  if (Array.isArray(structured)) {
    for (const row of structured) {
      if (!row || typeof row !== "object") continue;
      const subject = textOrBlank(row.subject || row.name || row.course);
      const grade = textOrBlank(row.grade || row.result || row.score);
      if (!subject || !grade) continue;
      if (/https?:\/\//i.test(subject) || /https?:\/\//i.test(grade)) continue;
      if (subject.includes("/") && subject.includes(".")) continue;
      parts.push(`${subject} — ${grade}`);
    }
  }

  const gradeType = textOrBlank(application.grade_type);
  const gradeValue = textOrBlank(application.gpa);
  if (gradeType && gradeValue) {
    parts.push(`${gradeType}: ${gradeValue}`);
  } else if (gradeValue) {
    parts.push(gradeValue);
  } else if (gradeType) {
    parts.push(gradeType);
  }

  return parts.join("\n");
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
  asOf = new Date(),
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
    level_of_study: textOrBlank(application.year_of_study),
    age: formatDirectorCopyAge(application.date_of_birth, asOf),
    academic_results: formatDirectorCopyAcademicResults(application),
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
 * Existing fields skip blanks. Extra optional fields show "Not provided" when selected but empty.
 */
export function formatDirectorCopyText(values, selectedFields = DIRECTOR_COPY_DEFAULT_FIELDS) {
  const keys = normalizeDirectorCopySelection(selectedFields);
  const lines = ["Applicant details", ""];
  let included = 0;
  for (const key of keys) {
    const label = DIRECTOR_COPY_FIELD_META[key].label;
    const value = textOrBlank(values?.[key]);
    if (!value) {
      if (!SHOW_EMPTY_AS_NOT_PROVIDED.has(key)) continue;
      lines.push(`${label}: ${DIRECTOR_COPY_NOT_PROVIDED}`);
      included += 1;
      continue;
    }
    if (value.includes("\n")) {
      lines.push(`${label}:`);
      for (const part of value.split("\n")) {
        if (part.trim()) lines.push(part.trim());
      }
    } else {
      lines.push(`${label}: ${value}`);
    }
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
