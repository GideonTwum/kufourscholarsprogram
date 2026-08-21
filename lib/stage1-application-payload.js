export const STAGE1_ALLOWED_FIELDS = [
  "full_name",
  "date_of_birth",
  "phone",
  "address",
  "hometown",
  "region",
  "country_of_origin",
  "nationality",
  "has_dual_citizenship",
  "second_citizenship_country",
  "emergency_contact_name",
  "emergency_contact_number",
  "emergency_contact_2_name",
  "emergency_contact_2_number",
  "linkedin_url",
  "instagram_url",
  "facebook_url",
  "tiktok_url",
  "snapchat_url",
  "twitter_url",
  "junior_high_school",
  "senior_high_school",
  "university",
  "student_id",
  "program",
  "year_of_study",
  "grade_type",
  "gpa",
  "confirms_ghana_enrollment",
  "cv_personal_statement_url",
  "cv_url",
  "academic_transcript_url",
  "leadership_evidence_urls",
  "leadership_evidence_url",
  "recommendation_url",
  "recommendation_urls",
  "photo_url",
  "student_id_path",
  "ksp_tiktok_follow_screenshot_path",
  "ksp_linkedin_follow_screenshot_path",
  "ksp_instagram_follow_screenshot_path",
  "concept_note_title",
  "concept_note_path",
];

const DANGEROUS_FIELDS = new Set([
  "id",
  "user_id",
  "applicant_id",
  "status",
  "submitted_at",
  "stage_1_submitted_at",
  "stage_1_approved_at",
  "stage_2_approved_at",
  "director_notes",
  "rejection_reason",
  "accepted_at",
  "rejected_at",
  "created_at",
  "updated_at",
  "application_class_name",
  "interview_date",
  "interview_time",
  "interview_location",
  "interview_instructions",
  "interview_slot_id",
  "assessor_id",
  "assigned_assessor_id",
  "panel_id",
  "evaluator_id",
  "evaluation_id",
  "overall_score",
  "total_weighted_score",
]);

const DANGEROUS_PATTERNS = [
  /^interview_/,
  /^assessor_/,
  /^panel_/,
  /^evaluation_/,
  /_score$/,
  /_notes$/,
];

export function isDangerousStage1Field(field) {
  return DANGEROUS_FIELDS.has(field) || DANGEROUS_PATTERNS.some((pattern) => pattern.test(field));
}

export function sanitizeStage1ApplicationData(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const allowed = new Set(STAGE1_ALLOWED_FIELDS);
  const data = {};
  const ignoredDangerousFields = [];

  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key)) {
      data[key] = value;
    } else if (isDangerousStage1Field(key)) {
      ignoredDangerousFields.push(key);
    }
  }

  return { data, ignoredDangerousFields };
}
