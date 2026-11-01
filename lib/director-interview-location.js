/**
 * Confirmed study location for interview logistics.
 * Region of study, town/city of study, and current institution.
 * Does not write applications.status, region, hometown, address, interview_slots, or allocations.
 */

import { fetchAllRowsForIds } from "./director-application-scope.js";
import { isCanonicalGhanaRegion } from "./ghana-regions.js";
import {
  STUDY_LOCATION_UNCONFIRMED_LABEL,
  UNKNOWN_LOCATION_KEY,
  studyInstitutionKey,
  studyTownKey,
} from "./director-location-filter.js";

export {
  effectiveCurrentTownDisplay,
  effectiveCurrentTownKey,
  effectiveCurrentTownLabel,
  effectiveResidentialRegionKey,
  effectiveResidentialRegionLabel,
  hasLocationConfirmation,
  studyInstitutionDisplay,
  studyRegionLabel,
  studyTownDisplay,
  virtualEligibilityForStudyRegion,
} from "./director-location-filter.js";

export const INTERVIEW_LOCATION_CONFIRMATION_TABLE = "application_interview_location_confirmations";

export const INTERVIEW_LOCATION_CONFIRMATION_SELECT =
  "id, application_id, confirmed_region, confirmed_town, study_institution, study_region, source, confirmed_by, confirmed_at, notes, created_at, updated_at";

export const INTERVIEW_LOCATION_SOURCES = Object.freeze({
  director: "director",
  applicant: "applicant",
});

export const INTERVIEW_LOCATION_FILTERS = Object.freeze([
  { key: "", label: "All study locations" },
  { key: "confirmed", label: "Study location confirmed" },
  { key: "unconfirmed", label: STUDY_LOCATION_UNCONFIRMED_LABEL },
]);

export const MAX_CONFIRMED_TOWN_LENGTH = 120;
export const MAX_STUDY_INSTITUTION_LENGTH = 200;
export const MAX_LOCATION_NOTES_LENGTH = 500;

export function uniqueInterviewTownOptions(rows) {
  const counts = new Map();
  let unknown = 0;
  for (const row of rows || []) {
    const key = studyTownKey(row);
    if (key === UNKNOWN_LOCATION_KEY) unknown += 1;
    else counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [
    { key: "", label: "All towns/cities of study" },
    { key: UNKNOWN_LOCATION_KEY, label: STUDY_LOCATION_UNCONFIRMED_LABEL, count: unknown },
    ...[...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count })),
  ];
}

export function uniqueInterviewInstitutionOptions(rows) {
  const counts = new Map();
  let unknown = 0;
  for (const row of rows || []) {
    const key = studyInstitutionKey(row);
    if (key === UNKNOWN_LOCATION_KEY) unknown += 1;
    else counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [
    { key: "", label: "All institutions" },
    { key: UNKNOWN_LOCATION_KEY, label: STUDY_LOCATION_UNCONFIRMED_LABEL, count: unknown },
    ...[...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count })),
  ];
}

export function validateInterviewLocationConfirmation({
  confirmedRegion,
  confirmedTown,
  studyInstitution,
  studyRegion,
  notes,
  source = INTERVIEW_LOCATION_SOURCES.director,
} = {}) {
  const region = isCanonicalGhanaRegion(studyRegion)
    ? String(studyRegion).trim()
    : isCanonicalGhanaRegion(confirmedRegion)
      ? String(confirmedRegion).trim()
      : "";
  if (!region) return { ok: false, error: "study_region_required" };
  const town = typeof confirmedTown === "string" ? confirmedTown.trim().replace(/\s+/g, " ") : "";
  if (!town) return { ok: false, error: "study_town_required" };
  if (town.length > MAX_CONFIRMED_TOWN_LENGTH) return { ok: false, error: "confirmed_town_too_long" };
  const allowedSource = Object.values(INTERVIEW_LOCATION_SOURCES);
  if (!allowedSource.includes(source)) return { ok: false, error: "invalid_location_source" };
  const institution =
    typeof studyInstitution === "string" ? studyInstitution.trim().replace(/\s+/g, " ") : "";
  if (!institution) return { ok: false, error: "study_institution_required" };
  if (institution.length > MAX_STUDY_INSTITUTION_LENGTH) {
    return { ok: false, error: "study_institution_too_long" };
  }
  let cleanNotes = null;
  if (notes != null && String(notes).trim()) {
    cleanNotes = String(notes).trim().replace(/\s+/g, " ");
    if (cleanNotes.length > MAX_LOCATION_NOTES_LENGTH) return { ok: false, error: "notes_too_long" };
  }
  return {
    ok: true,
    confirmed_region: region,
    confirmed_town: town,
    study_institution: institution,
    study_region: region,
    source,
    notes: cleanNotes,
  };
}

export function confirmationRowForUpsert(applicationId, validated, actorId) {
  const now = new Date().toISOString();
  return {
    application_id: applicationId,
    confirmed_region: validated.confirmed_region,
    confirmed_town: validated.confirmed_town,
    study_institution: validated.study_institution,
    study_region: validated.study_region,
    source: validated.source || INTERVIEW_LOCATION_SOURCES.director,
    notes: validated.notes,
    confirmed_by: actorId || null,
    confirmed_at: now,
    updated_at: now,
  };
}

export async function fetchInterviewLocationConfirmationsMap(client, applicationIds) {
  const ids = [...new Set((applicationIds || []).map((id) => String(id || "")).filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await fetchAllRowsForIds(
    (chunkIds) =>
      client
        .from(INTERVIEW_LOCATION_CONFIRMATION_TABLE)
        .select(INTERVIEW_LOCATION_CONFIRMATION_SELECT)
        .in("application_id", chunkIds),
    ids
  );
  if (error) return { __error: error };
  const map = {};
  for (const row of data || []) {
    if (row?.application_id) map[row.application_id] = row;
  }
  return map;
}

export function attachLocationConfirmations(rows, confirmationsById = {}) {
  return (rows || []).map((row) => ({
    ...row,
    location_confirmation: confirmationsById[row?.app?.id || row?.id] || row?.location_confirmation || null,
  }));
}

export async function persistInterviewLocationConfirmation(client, { applicationId, validated, actorId }) {
  if (!validated?.ok) return { error: validated?.error || "invalid_confirmation" };
  const row = confirmationRowForUpsert(applicationId, validated, actorId);
  const { data, error } = await client
    .from(INTERVIEW_LOCATION_CONFIRMATION_TABLE)
    .upsert(row, { onConflict: "application_id" })
    .select(INTERVIEW_LOCATION_CONFIRMATION_SELECT)
    .maybeSingle();
  if (error) return { error: error.message || "upsert_failed" };
  return { error: null, confirmation: data };
}

export async function deleteInterviewLocationConfirmation(client, applicationId) {
  const { error } = await client
    .from(INTERVIEW_LOCATION_CONFIRMATION_TABLE)
    .delete()
    .eq("application_id", applicationId);
  if (error) return { error: error.message || "delete_failed" };
  return { error: null };
}
