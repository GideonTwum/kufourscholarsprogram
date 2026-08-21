/**
 * Application form validation rules and helpers
 * Stage 1: Personal, Academic, Documents, Concept Note (no video)
 */

import { isAfricanCountryOfOrigin, isAfricanNationality } from "./eligibility-africa.js";
import {
  isAllowedAfricanCountrySelect,
  isAllowedWorldCountrySelect,
  isAllowedYearOfStudy,
  normalizeYearOfStudy,
} from "./countries.js";
import { stage2TitleConfirmationMessage } from "./application-class.js";

const MAX_FILE_SIZE_DOCS = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE_PHOTO = 5 * 1024 * 1024; // 5MB (passport / profile photo)
/** Concept Note title bounds (trimmed length). */
export const CONCEPT_NOTE_TITLE_MIN = 8;
export const CONCEPT_NOTE_TITLE_MAX = 200;
/**
 * PDF page-count is not programmatically enforced in this stack.
 * UI + review/compliance enforce the one-page rule; uploads still require PDF + size.
 */
export const CONCEPT_NOTE_PAGE_COUNT_ENFORCED = false;
export const CONCEPT_NOTE_ONE_PAGE_MESSAGE =
  "Concept Note must be a maximum of one page.";
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
  } else if (
    !isAllowedAfricanCountrySelect(data.country_of_origin) &&
    !isAfricanCountryOfOrigin(data.country_of_origin)
  ) {
    errors.country_of_origin =
      "Select a valid African country from the list. Eligibility is limited to African nationals.";
  }
  if (!data.nationality?.trim()) {
    errors.nationality = "Nationality is required";
  } else if (!isAfricanNationality(data.nationality)) {
    errors.nationality =
      "Must reflect African citizenship (e.g. Ghanaian, Nigerian, Kenyan, or your country name).";
  }

  const dualRaw = data.has_dual_citizenship;
  const dualAnswered =
    dualRaw === true ||
    dualRaw === false ||
    dualRaw === "true" ||
    dualRaw === "false";
  if (!dualAnswered) {
    errors.has_dual_citizenship = "Please indicate whether you have dual citizenship";
  } else {
    const dual = dualRaw === true || dualRaw === "true";
    if (dual) {
      const second = (data.second_citizenship_country || "").trim();
      if (!second) {
        errors.second_citizenship_country = "Second country of citizenship is required";
      } else if (!isAllowedWorldCountrySelect(second) && !isAfricanCountryOfOrigin(second)) {
        errors.second_citizenship_country = "Select a valid country from the list";
      } else if (
        second.toLowerCase() === String(data.country_of_origin || "").trim().toLowerCase()
      ) {
        errors.second_citizenship_country =
          "Second country must be different from Country of Origin";
      }
    }
  }
  if (!data.emergency_contact_name?.trim()) {
    errors.emergency_contact_name = "Emergency contact 1 name is required";
  }
  if (!data.emergency_contact_number?.trim()) {
    errors.emergency_contact_number = "Emergency contact 1 phone number is required";
  }
  // Contact 2 is optional; if either field is started, require both.
  const ec2Name = (data.emergency_contact_2_name || "").trim();
  const ec2Phone = (data.emergency_contact_2_number || "").trim();
  if (ec2Name || ec2Phone) {
    if (!ec2Name) {
      errors.emergency_contact_2_name = "Emergency contact 2 name is required when providing a second contact";
    }
    if (!ec2Phone) {
      errors.emergency_contact_2_number =
        "Emergency contact 2 phone number is required when providing a second contact";
    }
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

/** Recommendation letters: prefer jsonb array; fall back to legacy single path. */
export function getRecommendationLetterPaths(data) {
  const arr = data?.recommendation_urls;
  if (Array.isArray(arr) && arr.length) {
    return arr.filter((p) => typeof p === "string" && p.trim());
  }
  const leg = (data?.recommendation_url || "").trim();
  return leg ? [leg] : [];
}

export const MIN_RECOMMENDATION_LETTERS = 2;
export const MAX_RECOMMENDATION_LETTERS = 5;
export const MAX_LEADERSHIP_FILES = 10;

export const KSP_SOCIAL_HANDLES = {
  tiktok: "@kufuorscholars",
  linkedin: "Kufuor Scholars Program",
  instagram: "@kufuor_scholars_program",
};

export const CV_PERSONAL_STATEMENT_HINT =
  "Combined CV and personal statement in one PDF. Your personal statement must also describe your specific mentorship and coaching needs — the areas where you want mentorship, coaching, skills or leadership capabilities you want to develop, and the guidance or support that would help you grow.";

export const GRADE_TYPES = ["CWA", "CGPA", "GPA"];

export function validateAcademicInfo(data) {
  const errors = {};
  if (!data.junior_high_school?.trim()) {
    errors.junior_high_school = "Junior High School attended is required";
  }
  if (!data.senior_high_school?.trim()) {
    errors.senior_high_school = "Senior High School attended is required";
  }
  if (!data.university?.trim()) errors.university = "University is required";
  if (!data.program?.trim()) errors.program = "Program is required";
  if (!data.year_of_study) {
    errors.year_of_study = "Year of study is required";
  } else if (!isAllowedYearOfStudy(data.year_of_study)) {
    errors.year_of_study =
      "Only First Year and Sophomore applicants are eligible for this programme";
  }
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

function hasStoragePath(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateDocuments(data) {
  const errors = {};
  if (!data.cv_personal_statement_url) {
    errors.cv_personal_statement_url = "CV / Personal Statement is required";
  }
  if (!data.academic_transcript_url) {
    errors.academic_transcript_url = "Academic transcript is required";
  }
  // Leadership evidence is optional.
  const recommendations = getRecommendationLetterPaths(data);
  if (recommendations.length < MIN_RECOMMENDATION_LETTERS) {
    errors.recommendation_urls =
      "Please upload at least two recommendation letters before submitting Stage 1.";
  }
  if (!data.photo_url?.trim()) {
    errors.photo_url = "A passport-style photograph is required (JPG or PNG, max 5MB)";
  }
  if (!hasStoragePath(data.student_id_path)) {
    errors.student_id_path = "Student ID document is required";
  }
  if (!hasStoragePath(data.ksp_tiktok_follow_screenshot_path)) {
    errors.ksp_tiktok_follow_screenshot_path = `TikTok follow screenshot is required (${KSP_SOCIAL_HANDLES.tiktok})`;
  }
  if (!hasStoragePath(data.ksp_linkedin_follow_screenshot_path)) {
    errors.ksp_linkedin_follow_screenshot_path = `LinkedIn follow screenshot is required (${KSP_SOCIAL_HANDLES.linkedin})`;
  }
  if (!hasStoragePath(data.ksp_instagram_follow_screenshot_path)) {
    errors.ksp_instagram_follow_screenshot_path = `Instagram follow screenshot is required (${KSP_SOCIAL_HANDLES.instagram})`;
  }
  return errors;
}

/** Normalize Concept Note title without mutating passwords/secrets elsewhere. */
export function normalizeConceptNoteTitle(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ");
}

export function validateConceptNote(data) {
  const errors = {};
  const title = normalizeConceptNoteTitle(data?.concept_note_title);
  if (!title) {
    errors.concept_note_title = "Concept Note title is required";
  } else if (title.length < CONCEPT_NOTE_TITLE_MIN) {
    errors.concept_note_title = `Concept Note title must be at least ${CONCEPT_NOTE_TITLE_MIN} characters`;
  } else if (title.length > CONCEPT_NOTE_TITLE_MAX) {
    errors.concept_note_title = `Concept Note title must be at most ${CONCEPT_NOTE_TITLE_MAX} characters`;
  }

  const path = typeof data?.concept_note_path === "string" ? data.concept_note_path.trim() : "";
  if (!path) {
    errors.concept_note_path = "Upload your one-page Concept Note (PDF)";
  } else if (!/\.pdf$/i.test(path)) {
    errors.concept_note_path = "Concept Note must be a PDF file";
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
  if (!data.confirms_youtube_public) {
    errors.confirms_youtube_public = "Confirm that your YouTube video is public";
  }
  if (!data.confirms_youtube_title_format) {
    errors.confirms_youtube_title_format = stage2TitleConfirmationMessage(
      data.application_class_name
    );
  }
  if (!data.confirms_youtube_description_concept) {
    errors.confirms_youtube_description_concept =
      "Confirm that your concept note is used as the YouTube video description";
  }
  return errors;
}

/** Normalize dual-citizenship fields before save/submit */
export function normalizeDualCitizenshipFields(data) {
  const dual = data?.has_dual_citizenship === true || data?.has_dual_citizenship === "true";
  if (!dual) {
    return {
      ...data,
      has_dual_citizenship: false,
      second_citizenship_country: null,
    };
  }
  return {
    ...data,
    has_dual_citizenship: true,
    second_citizenship_country: (data.second_citizenship_country || "").trim() || null,
    year_of_study: normalizeYearOfStudy(data.year_of_study) || data.year_of_study,
  };
}

export function validateStep(stepIndex, data) {
  switch (stepIndex) {
    case 0:
      return validatePersonalInfo(data);
    case 1:
      return validateAcademicInfo(data);
    case 2:
      return validateDocuments(data);
    case 3:
      return validateConceptNote(data);
    default:
      return {};
  }
}

export function validateForSubmit(data) {
  return {
    ...validatePersonalInfo(data),
    ...validateAcademicInfo(data),
    ...validateDocuments(data),
    ...validateConceptNote(data),
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
    "has_dual_citizenship",
    "second_citizenship_country",
    "emergency_contact_name",
    "emergency_contact_number",
    "emergency_contact_2_name",
    "emergency_contact_2_number",
    "linkedin_url",
  ],
  [
    "junior_high_school",
    "senior_high_school",
    "university",
    "program",
    "year_of_study",
    "grade_type",
    "gpa",
    "confirms_ghana_enrollment",
  ],
  [
    "cv_personal_statement_url",
    "academic_transcript_url",
    "leadership_evidence_urls",
    "recommendation_urls",
    "recommendation_url",
    "photo_url",
    "student_id_path",
    "ksp_tiktok_follow_screenshot_path",
    "ksp_linkedin_follow_screenshot_path",
    "ksp_instagram_follow_screenshot_path",
  ],
  ["concept_note_title", "concept_note_path"],
];

export { MAX_FILE_SIZE_DOCS, MAX_FILE_SIZE_PHOTO, YOUTUBE_REGEX };
