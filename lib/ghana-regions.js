/**
 * Ghana's 16 administrative regions — single source of truth for Stage 1.
 * Store and validate exact display strings below (case-sensitive).
 */

export const GHANA_REGIONS = Object.freeze([
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
]);

export const GHANA_REGION_COUNT = GHANA_REGIONS.length;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalGhanaRegion(value) {
  if (typeof value !== "string") return false;
  return GHANA_REGIONS.includes(value.trim());
}

/**
 * @param {unknown} value
 * @returns {string|null} canonical region or null
 */
export function normalizeGhanaRegion(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return GHANA_REGIONS.includes(trimmed) ? trimmed : null;
}
