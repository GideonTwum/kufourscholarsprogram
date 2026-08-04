/**
 * Canonical announcement audiences for launch.
 */
export const ANNOUNCEMENT_AUDIENCES = [
  "all_applicants",
  "stage_1_submitted",
  "stage_1_approved",
  "stage_2_submitted",
  "called_for_interview",
  "accepted",
  "rejected",
  "assessors",
  "panel",
  "all_staff",
];

export const ANNOUNCEMENT_AUDIENCE_LABELS = {
  all_applicants: "All applicants",
  stage_1_submitted: "Stage 1 submitted",
  stage_1_approved: "Stage 1 approved",
  stage_2_submitted: "Stage 2 submitted",
  called_for_interview: "Called for interview",
  accepted: "Accepted",
  rejected: "Rejected",
  assessors: "Assessors",
  panel: "Panel",
  all_staff: "All staff",
};

export function isValidAnnouncementAudience(audience) {
  return ANNOUNCEMENT_AUDIENCES.includes(audience);
}
