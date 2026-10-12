/**
 * Director administrative correction of five applicant identity fields.
 * Does not touch status, assessments, assignments, documents, or timestamps.
 */

import { normalizeGender } from "./applicant-demographics.js";
import { normalizeUniversityForStorage } from "./ghana-tertiary-institutions.js";

export const DIRECTOR_EDITABLE_DETAIL_FIELDS = Object.freeze([
  "full_name",
  "university",
  "hometown",
  "program",
  "gender",
]);

const FIELD_SET = new Set(DIRECTOR_EDITABLE_DETAIL_FIELDS);

const LIMITS = {
  full_name: 200,
  university: 300,
  hometown: 200,
  program: 200,
  reason: 500,
};

export const APPLICANT_DETAILS_CORRECTION_ACTION = "application.details_corrected";

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

/**
 * @param {Record<string, unknown>} body
 * @param {{
 *   full_name?: string|null,
 *   university?: string|null,
 *   hometown?: string|null,
 *   program?: string|null,
 *   gender?: string|null,
 * }} current
 */
export function buildApplicantDetailsCorrection(body, current) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  const unknown = Object.keys(body).filter((key) => key !== "reason" && !FIELD_SET.has(key));
  if (unknown.length > 0) {
    return { ok: false, status: 400, error: "Unknown fields are not allowed." };
  }

  const reason = cleanText(body.reason);
  if (!reason) {
    return { ok: false, status: 400, error: "A reason for the correction is required." };
  }
  if (reason.length > LIMITS.reason) {
    return { ok: false, status: 400, error: "Reason is too long." };
  }

  const provided = DIRECTOR_EDITABLE_DETAIL_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  if (provided.length === 0) {
    return { ok: false, status: 400, error: "No editable fields were provided." };
  }

  /** @type {Record<string, string>} */
  const next = {};
  for (const field of provided) {
    if (field === "gender") {
      const gender = normalizeGender(body.gender);
      if (!gender) {
        return { ok: false, status: 400, error: "Gender must be Male or Female." };
      }
      next.gender = gender;
      continue;
    }
    if (field === "university") {
      const university = normalizeUniversityForStorage(body.university);
      if (!university) {
        return { ok: false, status: 400, error: "University is required." };
      }
      if (university.length > LIMITS.university) {
        return { ok: false, status: 400, error: "University is too long." };
      }
      next.university = university;
      continue;
    }
    const text = cleanText(body[field]);
    if (!text) {
      const label =
        field === "full_name" ? "Full name" : field === "hometown" ? "Hometown" : "Programme";
      return { ok: false, status: 400, error: `${label} is required.` };
    }
    if (text.length > LIMITS[field]) {
      return { ok: false, status: 400, error: "A field value is too long." };
    }
    next[field] = text;
  }

  /** @type {Record<string, string|null>} */
  const oldValue = {};
  /** @type {Record<string, string>} */
  const newValue = {};
  for (const field of Object.keys(next)) {
    const previous =
      field === "gender"
        ? normalizeGender(current?.[field]) || (current?.[field] == null ? null : String(current[field]))
        : cleanText(current?.[field] == null ? "" : String(current[field])) || null;
    const normalizedPrevious =
      field === "university" && previous ? normalizeUniversityForStorage(previous) : previous;
    if (normalizedPrevious === next[field]) continue;
    oldValue[field] = normalizedPrevious;
    newValue[field] = next[field];
  }

  if (Object.keys(newValue).length === 0) {
    return { ok: false, status: 400, error: "No changes to save." };
  }

  return {
    ok: true,
    reason,
    patch: newValue,
    oldValue,
    newValue,
    syncProfileName: Object.prototype.hasOwnProperty.call(newValue, "full_name"),
  };
}
