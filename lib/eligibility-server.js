/**
 * Server-side eligibility for auto-reject (must mirror lib/application-validation rules).
 */
import { isAfricanCountryOfOrigin, isAfricanNationality } from "./eligibility-africa.js";
import {
  AGE_ELIGIBILITY_MESSAGE,
  MAX_APPLICANT_AGE,
  NATIONAL_ID_LABEL,
  PASSPORT_PICTURE_LABEL,
  ageInYearsOnDateOfBirth,
  getRecommendationLetterPaths,
  isValidLinkedInProfileUrl,
  MIN_RECOMMENDATION_LETTERS,
} from "./application-validation.js";
import { isAllowedYearOfStudy } from "./countries.js";

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function evaluateEligibilityForAutoReject(data) {
  const age = ageInYearsOnDateOfBirth(data?.date_of_birth);
  if (age === null) {
    return { ok: false, reason: "Invalid or missing date of birth." };
  }
  if (age < 0) {
    return { ok: false, reason: "Invalid date of birth." };
  }
  if (age > MAX_APPLICANT_AGE) {
    return {
      ok: false,
      reason: AGE_ELIGIBILITY_MESSAGE,
    };
  }

  const country = (data?.country_of_origin || "").trim();
  if (!country) {
    return { ok: false, reason: "Country of origin is required." };
  }
  if (!isAfricanCountryOfOrigin(country)) {
    return {
      ok: false,
      reason: "Country of origin must be an African nation (citizenship is not limited to Ghana).",
    };
  }

  const nationality = (data?.nationality || "").trim();
  if (!nationality) {
    return { ok: false, reason: "Nationality is required." };
  }
  if (!isAfricanNationality(nationality)) {
    return {
      ok: false,
      reason: "Nationality must reflect African citizenship (not limited to Ghana).",
    };
  }

  const year = (data?.year_of_study || "").trim();
  if (!year) {
    return { ok: false, reason: "Year of study is required." };
  }
  if (!isAllowedYearOfStudy(year)) {
    return {
      ok: false,
      reason: "Only First Year and Sophomore applicants are eligible for this programme.",
    };
  }

  if (!data?.junior_high_school?.trim() || !data?.senior_high_school?.trim()) {
    return {
      ok: false,
      reason: "Junior High School and Senior High School attended are required.",
    };
  }

  const dual = data?.has_dual_citizenship === true || data?.has_dual_citizenship === "true";
  if (dual && !(data?.second_citizenship_country || "").trim()) {
    return { ok: false, reason: "Second country of citizenship is required for dual citizens." };
  }

  if (!data?.confirms_ghana_enrollment) {
    return {
      ok: false,
      reason:
        "You must be currently enrolled at a tertiary institution in Ghana (confirmed on the application).",
    };
  }

  // Leadership evidence is optional for Stage 1.

  if (!data?.cv_personal_statement_url || !data?.academic_transcript_url) {
    return { ok: false, reason: "All required documents must be uploaded." };
  }

  const recommendations = getRecommendationLetterPaths(data);
  if (recommendations.length < MIN_RECOMMENDATION_LETTERS) {
    return {
      ok: false,
      reason: "Please upload at least two recommendation letters before submitting Stage 1.",
    };
  }

  if (!data?.photo_url?.trim()) {
    return { ok: false, reason: `${PASSPORT_PICTURE_LABEL} is required.` };
  }

  if (!(typeof data?.student_id_path === "string" && data.student_id_path.trim())) {
    return { ok: false, reason: `${NATIONAL_ID_LABEL} document is required.` };
  }

  if (!(typeof data?.ksp_tiktok_follow_screenshot_path === "string" && data.ksp_tiktok_follow_screenshot_path.trim())) {
    return { ok: false, reason: "TikTok follow screenshot (@kufuorscholars) is required." };
  }
  if (
    !(typeof data?.ksp_linkedin_follow_screenshot_path === "string" &&
      data.ksp_linkedin_follow_screenshot_path.trim())
  ) {
    return {
      ok: false,
      reason: "LinkedIn follow screenshot (Kufuor Scholars Program) is required.",
    };
  }
  if (
    !(typeof data?.ksp_instagram_follow_screenshot_path === "string" &&
      data.ksp_instagram_follow_screenshot_path.trim())
  ) {
    return {
      ok: false,
      reason: "Instagram follow screenshot (@kufuor_scholars_program) is required.",
    };
  }

  const conceptTitle = typeof data?.concept_note_title === "string"
    ? data.concept_note_title.trim()
    : "";
  const conceptPath = typeof data?.concept_note_path === "string"
    ? data.concept_note_path.trim()
    : "";
  if (!conceptTitle || conceptTitle.length < 8) {
    return { ok: false, reason: "A valid Concept Note title is required." };
  }
  if (!conceptPath || !/\.pdf$/i.test(conceptPath)) {
    return { ok: false, reason: "A one-page Concept Note PDF upload is required." };
  }

  const li = (data?.linkedin_url || "").trim();
  if (!li || !isValidLinkedInProfileUrl(li)) {
    return { ok: false, reason: "A valid LinkedIn profile URL is required." };
  }

  if (!data?.emergency_contact_name?.trim() || !data?.emergency_contact_number?.trim()) {
    return { ok: false, reason: "Emergency contact 1 with a valid phone number is required." };
  }
  const ec2Name = (data?.emergency_contact_2_name || "").trim();
  const ec2Phone = (data?.emergency_contact_2_number || "").trim();
  if ((ec2Name && !ec2Phone) || (!ec2Name && ec2Phone)) {
    return {
      ok: false,
      reason: "If providing emergency contact 2, both name and phone number are required.",
    };
  }

  if (!data?.grade_type || !data?.gpa?.trim()) {
    return { ok: false, reason: "CWA / CGPA (or GPA) information is required." };
  }

  return { ok: true };
}
