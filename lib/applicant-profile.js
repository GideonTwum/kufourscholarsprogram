/**
 * Applicant profile corrections.
 * Identity fields that Directors and Assessors read live on applications.
 * Email and password stay in Supabase Auth and are not part of this patch.
 */

import { normalizeGender } from "./applicant-demographics.js";
import { normalizeUniversityForStorage } from "./ghana-tertiary-institutions.js";
import { ageInYearsOnDateOfBirth } from "./application-validation.js";

export const APPLICANT_PROFILE_FIELDS = Object.freeze([
  "full_name",
  "date_of_birth",
  "gender",
  "hometown",
  "phone",
  "university",
  "program",
]);

const FIELD_SET = new Set(APPLICANT_PROFILE_FIELDS);

const LIMITS = {
  full_name: 200,
  hometown: 200,
  phone: 30,
  university: 300,
  program: 200,
};

export const APPLICANT_PROFILE_UPDATED_ACTION = "applicant.profile_updated";
export const APPLICANT_EMAIL_REQUESTED_ACTION = "applicant.email_change_requested";
export const APPLICANT_EMAIL_VERIFIED_ACTION = "applicant.email_verified";
export const APPLICANT_PASSWORD_CHANGED_ACTION = "applicant.password_changed";

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export function isPlausiblePhone(value) {
  const text = cleanText(value);
  if (text.length < 7 || text.length > LIMITS.phone) return false;
  return /^\+?[0-9][0-9\s()-]{6,28}$/.test(text);
}

/**
 * @param {Record<string, unknown>} body
 * @param {Record<string, unknown>} current
 */
export function buildApplicantProfilePatch(body, current) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Invalid request." };
  }

  const unknown = Object.keys(body).filter(
    (key) => key !== "baseUpdatedAt" && !FIELD_SET.has(key)
  );
  if (unknown.length > 0) {
    return { ok: false, status: 400, error: "Unknown fields are not allowed." };
  }

  const provided = APPLICANT_PROFILE_FIELDS.filter((field) =>
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
      if (!gender) return { ok: false, status: 400, error: "Gender must be Male or Female." };
      next.gender = gender;
      continue;
    }
    if (field === "university") {
      const university = normalizeUniversityForStorage(body.university);
      if (!university) return { ok: false, status: 400, error: "University is required." };
      if (university.length > LIMITS.university) {
        return { ok: false, status: 400, error: "University is too long." };
      }
      next.university = university;
      continue;
    }
    if (field === "date_of_birth") {
      const raw = typeof body.date_of_birth === "string" ? body.date_of_birth.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
        return { ok: false, status: 400, error: "Please enter a valid date of birth." };
      }
      const age = ageInYearsOnDateOfBirth(raw);
      if (age === null || age < 0 || age > 100) {
        return { ok: false, status: 400, error: "Please enter a valid date of birth." };
      }
      next.date_of_birth = raw;
      continue;
    }
    if (field === "phone") {
      const phone = cleanText(body.phone);
      if (!isPlausiblePhone(phone)) {
        return { ok: false, status: 400, error: "Enter a valid phone number." };
      }
      next.phone = phone;
      continue;
    }
    const text = cleanText(body[field]);
    if (!text) {
      return { ok: false, status: 400, error: "A required field is empty." };
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
    const previousRaw = current?.[field] == null ? "" : String(current[field]);
    const previous =
      field === "gender"
        ? normalizeGender(previousRaw) || previousRaw || null
        : field === "university"
          ? normalizeUniversityForStorage(previousRaw) || null
          : field === "date_of_birth"
            ? previousRaw.slice(0, 10) || null
            : cleanText(previousRaw) || null;
    if (previous === next[field]) continue;
    oldValue[field] = previous;
    newValue[field] = next[field];
  }

  if (Object.keys(newValue).length === 0) {
    return { ok: false, status: 400, error: "No changes to save." };
  }

  return { ok: true, patch: newValue, oldValue, newValue };
}

export function profileUpdateConflicts(currentUpdatedAt, baseUpdatedAt) {
  const current = currentUpdatedAt ? String(currentUpdatedAt) : "";
  const base = baseUpdatedAt ? String(baseUpdatedAt) : "";
  if (!current) return false;
  return current !== base;
}
