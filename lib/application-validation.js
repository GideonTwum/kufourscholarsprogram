/**
 * Application form validation rules and helpers
 * Stage 1: Personal, Academic, Documents (no video)
 */

const MAX_FILE_SIZE_DOCS = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE_PHOTO = 2 * 1024 * 1024; // 2MB
const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/i;

export function validatePersonalInfo(data) {
  const errors = {};
  if (!data.full_name?.trim()) errors.full_name = "Full name is required";
  if (!data.date_of_birth) errors.date_of_birth = "Date of birth is required";
  if (!data.phone?.trim()) errors.phone = "Phone number is required";
  if (!data.address?.trim()) errors.address = "Address is required";
  if (!data.country_of_origin?.trim()) errors.country_of_origin = "Country of origin is required";
  if (!data.nationality?.trim()) errors.nationality = "Nationality is required";
  return errors;
}

export function validateAcademicInfo(data) {
  const errors = {};
  if (!data.university?.trim()) errors.university = "University is required";
  if (!data.program?.trim()) errors.program = "Program is required";
  if (!data.year_of_study) errors.year_of_study = "Year of study is required";
  if (!data.gpa?.trim()) errors.gpa = "GPA or grade is required";
  return errors;
}

export function validateDocuments(data) {
  const errors = {};
  if (!data.cv_personal_statement_url) errors.cv_personal_statement_url = "CV / Personal Statement is required";
  if (!data.academic_transcript_url) errors.academic_transcript_url = "Academic transcript is required";
  if (!data.leadership_evidence_url) errors.leadership_evidence_url = "Evidence of leadership is required";
  if (!data.recommendation_url) errors.recommendation_url = "Recommendation letter is required";
  return errors;
}

export function validateStage2Video(data) {
  const errors = {};
  const vid = (data.video_youtube_url || "").trim();
  if (!vid) {
    errors.video_youtube_url = "YouTube video link is required";
  } else if (!YOUTUBE_REGEX.test(vid)) {
    errors.video_youtube_url = "Please enter a valid YouTube link (youtube.com or youtu.be)";
  }
  return errors;
}

export function validateStep(stepIndex, data) {
  switch (stepIndex) {
    case 0:
      return validatePersonalInfo(data);
    case 1:
      return validateAcademicInfo(data);
    case 2:
      return validateDocuments(data);
    default:
      return {};
  }
}

export function validateForSubmit(data) {
  return {
    ...validatePersonalInfo(data),
    ...validateAcademicInfo(data),
    ...validateDocuments(data),
  };
}

export { MAX_FILE_SIZE_DOCS, MAX_FILE_SIZE_PHOTO, YOUTUBE_REGEX };
