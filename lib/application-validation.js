/**
 * Application form validation rules and helpers
 * Stage 1: Personal, Academic, Documents (no video)
 */

import { isAfricanCountryOfOrigin, isAfricanNationality } from "@/lib/eligibility-africa";

const MAX_FILE_SIZE_DOCS = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE_PHOTO = 2 * 1024 * 1024; // 2MB
/** Must match public eligibility (Apply page & FAQs). */
export const MAX_APPLICANT_AGE = 25;
const YOUTUBE_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/i;

/** LinkedIn profile or org page — required for applicants */
export function isValidLinkedInProfileUrl(url) {
  const raw = (url || "").trim();
  if (!raw) return false;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) {
      return false;
    }
    const path = u.pathname.toLowerCase();
    // /in/..., /pub/..., /company/..., /school/...
    return (
      /^\/in\/[^/]+/i.test(path) ||
      /^\/pub\/[^/]+/i.test(path) ||
      /^\/company\/[^/]+/i.test(path) ||
      /^\/school\/[^/]+/i.test(path)
    );
  } catch {
    return false;
  }
}

function ageInYearsOnDateOfBirth(dateOfBirthStr, ref = new Date()) {
  if (!dateOfBirthStr || typeof dateOfBirthStr !== "string") return null;
  const parts = dateOfBirthStr.split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  const dob = new Date(y, m, d);
  if (Number.isNaN(dob.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const monthDiff = ref.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function validatePersonalInfo(data) {
  const errors = {};
  if (!data.full_name?.trim()) errors.full_name = "Full name is required";
  if (!data.date_of_birth) errors.date_of_birth = "Date of birth is required";
  else {
    const age = ageInYearsOnDateOfBirth(data.date_of_birth);
    if (age === null) errors.date_of_birth = "Please enter a valid date of birth";
    else if (age < 0) errors.date_of_birth = "Please enter a valid date of birth";
    else if (age > MAX_APPLICANT_AGE) {
      errors.date_of_birth = `Applicants must be ${MAX_APPLICANT_AGE} or under at the time of application`;
    }
  }
  if (!data.phone?.trim()) errors.phone = "Phone number is required";
  if (!data.address?.trim()) errors.address = "Address is required";
  if (!data.country_of_origin?.trim()) {
    errors.country_of_origin = "Country of origin is required";
  } else if (!isAfricanCountryOfOrigin(data.country_of_origin)) {
    errors.country_of_origin =
      "Must be an African country. Eligibility is limited to African nationals.";
  }
  if (!data.nationality?.trim()) {
    errors.nationality = "Nationality is required";
  } else if (!isAfricanNationality(data.nationality)) {
    errors.nationality =
      "Must reflect African citizenship (e.g. Ghanaian, Nigerian, Kenyan, or your country name).";
  }
  if (!data.emergency_contact_name?.trim()) {
    errors.emergency_contact_name = "Emergency contact 1 name is required";
  }
  if (!data.emergency_contact_number?.trim()) {
    errors.emergency_contact_number = "Emergency contact 1 phone number is required";
  }
  if (!data.emergency_contact_2_name?.trim()) {
    errors.emergency_contact_2_name = "Emergency contact 2 name is required";
  }
  if (!data.emergency_contact_2_number?.trim()) {
    errors.emergency_contact_2_number = "Emergency contact 2 phone number is required";
  }
  const linkedin = (data.linkedin_url || "").trim();
  if (!linkedin) {
    errors.linkedin_url = "LinkedIn profile URL is required";
  } else if (!isValidLinkedInProfileUrl(linkedin)) {
    errors.linkedin_url =
      "Enter a valid LinkedIn URL (e.g. https://www.linkedin.com/in/your-profile)";
  }
  return errors;
}

/** Normalize leadership file paths from form data (array + legacy single field). */
export function getLeadershipEvidencePaths(data) {
  const arr = data?.leadership_evidence_urls;
  if (Array.isArray(arr) && arr.length) return arr.filter((p) => typeof p === "string" && p.trim());
  const leg = (data?.leadership_evidence_url || "").trim();
  return leg ? [leg] : [];
}

export const GRADE_TYPES = ["CWA", "CGPA", "GPA"];

export function validateAcademicInfo(data) {
  const errors = {};
  if (!data.university?.trim()) errors.university = "University is required";
  if (!data.program?.trim()) errors.program = "Program is required";
  if (!data.year_of_study) errors.year_of_study = "Year of study is required";
  if (!data.grade_type || !GRADE_TYPES.includes(data.grade_type)) {
    errors.grade_type = "Select whether your grade is CWA, CGPA, or GPA";
  }
  if (!data.gpa?.trim()) {
    errors.gpa = "Enter your current CWA, CGPA, or GPA (matching the type selected)";
  }
  if (!data.confirms_ghana_enrollment) {
    errors.confirms_ghana_enrollment =
      "You must confirm you are currently enrolled at a tertiary institution in Ghana to continue.";
  }
  return errors;
}

export function validateDocuments(data) {
  const errors = {};
  if (!data.cv_personal_statement_url) errors.cv_personal_statement_url = "CV / Personal Statement is required";
  if (!data.academic_transcript_url) errors.academic_transcript_url = "Academic transcript is required";
  const leadershipPaths = getLeadershipEvidencePaths(data);
  if (leadershipPaths.length === 0) {
    errors.leadership_evidence_urls = "Upload at least one PDF as evidence of leadership (you may add several)";
  }
  if (!data.recommendation_url) errors.recommendation_url = "Recommendation letter is required";
  if (!data.photo_url?.trim()) {
    errors.photo_url = "A passport-style photograph is required (JPG or PNG, max 2MB)";
  }
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

/** Field keys per step for clearing errors when re-validating */
export const STEP_VALIDATION_FIELDS = [
  [
    "full_name",
    "date_of_birth",
    "phone",
    "address",
    "country_of_origin",
    "nationality",
    "emergency_contact_name",
    "emergency_contact_number",
    "emergency_contact_2_name",
    "emergency_contact_2_number",
    "linkedin_url",
  ],
  ["university", "program", "year_of_study", "grade_type", "gpa", "confirms_ghana_enrollment"],
  [
    "cv_personal_statement_url",
    "academic_transcript_url",
    "leadership_evidence_urls",
    "recommendation_url",
    "photo_url",
  ],
];

export { MAX_FILE_SIZE_DOCS, MAX_FILE_SIZE_PHOTO, YOUTUBE_REGEX };
