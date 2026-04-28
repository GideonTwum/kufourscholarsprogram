/**
 * Server-side eligibility for auto-reject (must mirror lib/application-validation rules).
 */
import { isAfricanCountryOfOrigin, isAfricanNationality } from "@/lib/eligibility-africa";
import {
  MAX_APPLICANT_AGE,
  getLeadershipEvidencePaths,
  isValidLinkedInProfileUrl,
} from "@/lib/application-validation";

function ageOnDob(dateOfBirthStr, ref = new Date()) {
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
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) age -= 1;
  return age;
}

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function evaluateEligibilityForAutoReject(data) {
  const age = ageOnDob(data?.date_of_birth);
  if (age === null) {
    return { ok: false, reason: "Invalid or missing date of birth." };
  }
  if (age < 0) {
    return { ok: false, reason: "Invalid date of birth." };
  }
  if (age > MAX_APPLICANT_AGE) {
    return {
      ok: false,
      reason: `Age must be ${MAX_APPLICANT_AGE} or under at the time of application (eligibility requirement).`,
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

  if (!data?.confirms_ghana_enrollment) {
    return {
      ok: false,
      reason:
        "You must be currently enrolled at a tertiary institution in Ghana (confirmed on the application).",
    };
  }

  const leadership = getLeadershipEvidencePaths(data);
  if (leadership.length === 0) {
    return { ok: false, reason: "Evidence of leadership uploads are required." };
  }

  if (!data?.cv_personal_statement_url || !data?.academic_transcript_url || !data?.recommendation_url) {
    return { ok: false, reason: "All required documents must be uploaded." };
  }

  if (!data?.photo_url?.trim()) {
    return { ok: false, reason: "Passport-style photograph is required." };
  }

  const li = (data?.linkedin_url || "").trim();
  if (!li || !isValidLinkedInProfileUrl(li)) {
    return { ok: false, reason: "A valid LinkedIn profile URL is required." };
  }

  if (
    !data?.emergency_contact_name?.trim() ||
    !data?.emergency_contact_number?.trim() ||
    !data?.emergency_contact_2_name?.trim() ||
    !data?.emergency_contact_2_number?.trim()
  ) {
    return { ok: false, reason: "Two emergency contacts with valid phone numbers are required." };
  }

  if (!data?.grade_type || !data?.gpa?.trim()) {
    return { ok: false, reason: "CWA / CGPA (or GPA) information is required." };
  }

  return { ok: true };
}
