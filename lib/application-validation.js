/**
 * Application form validation rules and helpers
 */

const MIN_ESSAY_WORDS = 300;
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

export function validateEssayVideo(data) {
  const errors = {};
  const wordCount = (data.essay || "").split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_ESSAY_WORDS) {
    errors.essay = `Essay must be at least ${MIN_ESSAY_WORDS} words (currently ${wordCount})`;
  }
  const vid = (data.video_url || "").trim();
  if (!vid) {
    errors.video_url = "YouTube video link is required";
  } else if (!YOUTUBE_REGEX.test(vid)) {
    errors.video_url = "Please enter a valid YouTube link (youtube.com or youtu.be)";
  }
  return errors;
}

export function validateDocuments(data) {
  const errors = {};
  if (!data.cv_url) errors.cv_url = "CV / Resume is required";
  if (!data.recommendation_url) errors.recommendation_url = "Recommendation letter is required";
  if (!data.photo_url) errors.photo_url = "Passport photo is required";
  return errors;
}

export function validateStep(stepIndex, data) {
  switch (stepIndex) {
    case 0:
      return validatePersonalInfo(data);
    case 1:
      return validateAcademicInfo(data);
    case 2:
      return validateEssayVideo(data);
    case 3:
      return validateDocuments(data);
    default:
      return {};
  }
}

export function validateForSubmit(data) {
  return {
    ...validatePersonalInfo(data),
    ...validateAcademicInfo(data),
    ...validateEssayVideo(data),
    ...validateDocuments(data),
  };
}

export function getEssayWordCount(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

export { MIN_ESSAY_WORDS, MAX_FILE_SIZE_DOCS, MAX_FILE_SIZE_PHOTO, YOUTUBE_REGEX };
