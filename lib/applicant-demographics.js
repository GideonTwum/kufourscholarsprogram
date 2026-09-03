/**
 * Shared Stage 1 demographic helpers (gender, region, university).
 * Used by client forms, validation, and server submit.
 */

import {
  GHANA_REGIONS,
  isCanonicalGhanaRegion,
  normalizeGhanaRegion,
} from "./ghana-regions.js";
import {
  findCanonicalTertiaryInstitution,
  isCanonicalTertiaryInstitution,
  normalizeUniversityForStorage,
  OTHER_INSTITUTION_OPTION,
  OTHER_INSTITUTION_SELECT_VALUE,
} from "./ghana-tertiary-institutions.js";

export const GENDER_VALUES = Object.freeze(["male", "female"]);

export const GENDER_OPTIONS = Object.freeze([
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
]);

export {
  GHANA_REGIONS,
  isCanonicalGhanaRegion,
  normalizeGhanaRegion,
  findCanonicalTertiaryInstitution,
  isCanonicalTertiaryInstitution,
  normalizeUniversityForStorage,
  OTHER_INSTITUTION_OPTION,
  OTHER_INSTITUTION_SELECT_VALUE,
};

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidGender(value) {
  return typeof value === "string" && GENDER_VALUES.includes(value.trim().toLowerCase());
}

/**
 * Canonical stored gender: "male" | "female" | null (empty / invalid → null for drafts).
 * @param {unknown} value
 * @returns {"male"|"female"|null}
 */
export function normalizeGender(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "male" || v === "female") return v;
  return null;
}

/**
 * User-facing gender label for review / staff views.
 * @param {unknown} value
 * @returns {string}
 */
export function formatGenderLabel(value) {
  const g = normalizeGender(value);
  if (g === "male") return "Male";
  if (g === "female") return "Female";
  return "";
}

/**
 * Normalize demographics fields before save/submit (non-destructive for drafts).
 * @param {Record<string, unknown>} data
 */
export function normalizeDemographicsFields(data) {
  const gender = normalizeGender(data?.gender);
  const regionRaw = typeof data?.region === "string" ? data.region.trim() : data?.region;
  const regionCanonical = normalizeGhanaRegion(regionRaw);
  // Keep legacy free-text region on draft saves; submit validation rejects non-canonical.
  const region =
    regionCanonical ||
    (typeof regionRaw === "string" && regionRaw.trim() ? regionRaw.trim() : null);

  const university = normalizeUniversityForStorage(data?.university);

  return {
    ...data,
    gender,
    region: region || null,
    university: university || "",
  };
}

/**
 * Validate gender / region / university for Stage 1 continue & final submit.
 * @param {Record<string, unknown>} data
 * @returns {Record<string, string>}
 */
export function validateDemographicsForSubmit(data) {
  const errors = {};

  const gender = normalizeGender(data?.gender);
  if (!gender) {
    errors.gender = "Gender is required";
  } else if (!isValidGender(gender)) {
    errors.gender = "Select Male or Female";
  }

  const regionRaw = typeof data?.region === "string" ? data.region.trim() : "";
  if (!regionRaw) {
    errors.region = "Region is required";
  } else if (!isCanonicalGhanaRegion(regionRaw)) {
    errors.region = "Select a valid Ghana region from the list";
  }

  const university = normalizeUniversityForStorage(data?.university);
  if (!university) {
    errors.university = "University / Institution is required";
  }

  return errors;
}
