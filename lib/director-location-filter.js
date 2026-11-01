/**
 * Director interview location filters.
 *
 * Interview logistics use confirmed study location only:
 * region of study, town/city of study, and current institution.
 * Never hometown, residential region, address parsing, or geocoding.
 */

import { GHANA_REGIONS, normalizeGhanaRegion } from "./ghana-regions.js";

export const UNKNOWN_LOCATION_KEY = "unknown";

export const UNKNOWN_LOCATION_LABEL = "Not Provided";

export const STUDY_LOCATION_UNCONFIRMED_LABEL = "Study Location Not Confirmed";

/**
 * Example northern regions for documentation only.
 * Virtual eligibility uses interview_schedules.virtual_eligible_study_regions.
 * Do not treat this list as approved policy.
 */
export const DISTANT_GHANA_REGIONS = Object.freeze([
  "Northern",
  "North East",
  "Savannah",
  "Upper East",
  "Upper West",
]);

const DISTANT_SET = new Set(DISTANT_GHANA_REGIONS);

export const DIRECTOR_REGION_FILTERS = Object.freeze([
  { key: "", label: "All regions of study" },
  { key: UNKNOWN_LOCATION_KEY, label: STUDY_LOCATION_UNCONFIRMED_LABEL },
  ...GHANA_REGIONS.map((name) => ({
    key: name,
    label: name,
  })),
]);

export const DIRECTOR_TOWN_FILTERS = Object.freeze([
  { key: "", label: "All towns/cities of study" },
  { key: UNKNOWN_LOCATION_KEY, label: STUDY_LOCATION_UNCONFIRMED_LABEL },
]);

export function normalizeDirectorRegionParam(raw) {
  if (raw == null) return "";
  const key = String(raw).trim();
  if (!key || key === "all") return "";
  if (key === UNKNOWN_LOCATION_KEY) return UNKNOWN_LOCATION_KEY;
  return normalizeGhanaRegion(key) || "";
}

export function normalizeDirectorTownParam(raw) {
  if (raw == null) return "";
  const key = String(raw).trim();
  if (!key || key === "all") return "";
  if (key === UNKNOWN_LOCATION_KEY) return UNKNOWN_LOCATION_KEY;
  return key.slice(0, 120);
}

export function normalizeDirectorInstitutionParam(raw) {
  if (raw == null) return "";
  const key = String(raw).trim();
  if (!key || key === "all") return "";
  if (key === UNKNOWN_LOCATION_KEY) return UNKNOWN_LOCATION_KEY;
  return key.slice(0, 200);
}

export function normalizeDirectorLocationParam(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key === "all") return "";
  if (key === "confirmed" || key === "unconfirmed") return key;
  return "";
}

export function locationConfirmationOf(row) {
  return row?.location_confirmation || row?.confirmation || null;
}

export function residentialRegionKey(app) {
  return normalizeGhanaRegion(app?.region) || UNKNOWN_LOCATION_KEY;
}

export function residentialRegionLabel(app) {
  const key = residentialRegionKey(app);
  return key === UNKNOWN_LOCATION_KEY ? UNKNOWN_LOCATION_LABEL : key;
}

export function currentTownLabel(app) {
  const town = typeof app?.current_town === "string" ? app.current_town.trim() : "";
  return town || null;
}

export function currentTownKey(app) {
  return currentTownLabel(app) || UNKNOWN_LOCATION_KEY;
}

export function currentTownDisplay(app) {
  return currentTownLabel(app) || UNKNOWN_LOCATION_LABEL;
}

function confirmationStudyRegion(row) {
  const confirmation = locationConfirmationOf(row);
  if (!confirmation) return null;
  return (
    normalizeGhanaRegion(confirmation.study_region) ||
    normalizeGhanaRegion(confirmation.confirmed_region) ||
    null
  );
}

function confirmationStudyTown(row) {
  const town = locationConfirmationOf(row)?.confirmed_town;
  return typeof town === "string" && town.trim() ? town.trim() : null;
}

function confirmationStudyInstitution(row) {
  const institution = locationConfirmationOf(row)?.study_institution;
  return typeof institution === "string" && institution.trim() ? institution.trim() : null;
}

/** Confirmed region of study only. Never applications.region or hometown. */
export function studyRegionKey(row) {
  return confirmationStudyRegion(row) || UNKNOWN_LOCATION_KEY;
}

export function studyRegionLabel(row) {
  const key = studyRegionKey(row);
  return key === UNKNOWN_LOCATION_KEY ? STUDY_LOCATION_UNCONFIRMED_LABEL : key;
}

export function studyTownLabel(row) {
  return confirmationStudyTown(row);
}

export function studyTownKey(row) {
  return confirmationStudyTown(row) || UNKNOWN_LOCATION_KEY;
}

export function studyTownDisplay(row) {
  return confirmationStudyTown(row) || STUDY_LOCATION_UNCONFIRMED_LABEL;
}

export function studyInstitutionLabel(row) {
  return confirmationStudyInstitution(row);
}

export function studyInstitutionKey(row) {
  return confirmationStudyInstitution(row) || UNKNOWN_LOCATION_KEY;
}

export function studyInstitutionDisplay(row) {
  return confirmationStudyInstitution(row) || STUDY_LOCATION_UNCONFIRMED_LABEL;
}

export function hasLocationConfirmation(row) {
  return Boolean(
    confirmationStudyRegion(row) && confirmationStudyTown(row) && confirmationStudyInstitution(row)
  );
}

export function filterByDirectorStudyRegion(rows, regionFilter) {
  const list = Array.isArray(rows) ? rows : [];
  const key = normalizeDirectorRegionParam(regionFilter);
  if (!key) return list;
  return list.filter((row) => studyRegionKey(row) === key);
}

export function filterByDirectorStudyTown(rows, townFilter) {
  const list = Array.isArray(rows) ? rows : [];
  const key = normalizeDirectorTownParam(townFilter);
  if (!key) return list;
  return list.filter((row) => studyTownKey(row) === key);
}

export function filterByDirectorStudyInstitution(rows, institutionFilter) {
  const list = Array.isArray(rows) ? rows : [];
  const key = normalizeDirectorInstitutionParam(institutionFilter);
  if (!key) return list;
  return list.filter((row) => studyInstitutionKey(row) === key);
}

export function filterByDirectorLocationConfirmation(rows, locationFilter) {
  const list = Array.isArray(rows) ? rows : [];
  const key = normalizeDirectorLocationParam(locationFilter);
  if (!key) return list;
  return list.filter((row) =>
    key === "confirmed" ? hasLocationConfirmation(row) : !hasLocationConfirmation(row)
  );
}

/** @deprecated Interview filters use study location. Kept as an alias. */
export function filterByDirectorResidentialRegion(rows, regionFilter) {
  return filterByDirectorStudyRegion(rows, regionFilter);
}

/** @deprecated Interview filters use town/city of study. Kept as an alias. */
export function filterByDirectorCurrentTown(rows, townFilter) {
  return filterByDirectorStudyTown(rows, townFilter);
}

export function effectiveResidentialRegionKey(row) {
  return studyRegionKey(row);
}

export function effectiveResidentialRegionLabel(row) {
  return studyRegionLabel(row);
}

export function effectiveCurrentTownLabel(row) {
  return studyTownLabel(row);
}

export function effectiveCurrentTownKey(row) {
  return studyTownKey(row);
}

export function effectiveCurrentTownDisplay(row) {
  return studyTownDisplay(row);
}

export function normalizeVirtualEligibleStudyRegions(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\n]/)
      : [];
  return [...new Set(list.map((value) => normalizeGhanaRegion(value)).filter(Boolean))];
}

export function virtualEligibilityForStudyRegion(studyRegion, configuredRegions) {
  const configured = normalizeVirtualEligibleStudyRegions(configuredRegions);
  const region = normalizeGhanaRegion(studyRegion);
  if (!configured.length) {
    return {
      configured: false,
      eligible: false,
      autoApprove: false,
      reason: "eligibility_regions_not_configured",
    };
  }
  if (!region) {
    return {
      configured: true,
      eligible: false,
      autoApprove: false,
      reason: "study_location_not_confirmed",
    };
  }
  const eligible = configured.includes(region);
  return {
    configured: true,
    eligible,
    autoApprove: false,
    reason: eligible ? "study_region_in_configured_list" : "study_region_not_in_configured_list",
  };
}

/** Geographic helper only. Not virtual-interview policy. */
export function isDistantGhanaRegion(regionOrApp) {
  const region =
    typeof regionOrApp === "string"
      ? normalizeGhanaRegion(regionOrApp) || regionOrApp
      : normalizeGhanaRegion(regionOrApp?.region) || "";
  return DISTANT_SET.has(region);
}
