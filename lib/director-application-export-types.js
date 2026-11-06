/**
 * Allowlisted Director Excel export categories.
 * Kept separate from the workbook builder so the Applications UI does not load ExcelJS.
 */

export const DIRECTOR_EXPORT_TYPES = Object.freeze([
  "called_for_interview",
  "rejected",
  "pending",
  "stage_1",
  "stage_2",
  "all_submitted",
  "university_special_invitees",
  "current_filtered",
]);

export const DIRECTOR_EXPORT_LABELS = Object.freeze({
  called_for_interview: "Called for Interview",
  rejected: "Rejected Applicants",
  pending: "Pending Applications",
  stage_1: "Stage 1 Applicants",
  stage_2: "Stage 2 Applicants",
  all_submitted: "All Submitted Applications",
  university_special_invitees: "University Special Invitees",
  current_filtered: "Export Current Filtered Results",
});

const FILE_SLUGS = Object.freeze({
  called_for_interview: "Called_For_Interview",
  rejected: "Rejected_Applicants",
  pending: "Pending_Applications",
  stage_1: "Stage_1_Applicants",
  stage_2: "Stage_2_Applicants",
  all_submitted: "All_Applications",
  university_special_invitees: "University_Special_Invitees",
  current_filtered: "Filtered_Applications",
});

export function isDirectorExportType(type) {
  return DIRECTOR_EXPORT_TYPES.includes(type);
}

export function directorExportFilename(type, date = new Date()) {
  const day = (date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10);
  const slug = FILE_SLUGS[type] || "Export";
  return `KSP_${slug}_${day}.xlsx`;
}
