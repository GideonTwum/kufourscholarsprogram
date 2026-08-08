/**
 * Country lists for applicant forms.
 * Country of Origin uses African nations (programme eligibility).
 * Second citizenship may be any country (dual citizenship).
 */

/** Canonical African country display names for Country of Origin dropdown */
export const AFRICAN_COUNTRIES = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo",
  "Côte d'Ivoire",
  "Democratic Republic of the Congo",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "São Tomé and Príncipe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
];

/** Broader list for dual / second citizenship */
export const WORLD_COUNTRIES = [
  ...AFRICAN_COUNTRIES,
  "Afghanistan",
  "Albania",
  "Argentina",
  "Australia",
  "Austria",
  "Bangladesh",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Croatia",
  "Czech Republic",
  "Denmark",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hong Kong",
  "Hungary",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Jordan",
  "South Korea",
  "Kuwait",
  "Lebanon",
  "Malaysia",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Pakistan",
  "Palestine",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "Spain",
  "Sweden",
  "Switzerland",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
].sort((a, b) => a.localeCompare(b));

const AFRICAN_SET = new Set(AFRICAN_COUNTRIES.map((c) => c.toLowerCase()));
const WORLD_SET = new Set(WORLD_COUNTRIES.map((c) => c.toLowerCase()));

export function isAllowedAfricanCountrySelect(value) {
  const v = String(value || "").trim().toLowerCase();
  return Boolean(v && AFRICAN_SET.has(v));
}

export function isAllowedWorldCountrySelect(value) {
  const v = String(value || "").trim().toLowerCase();
  return Boolean(v && WORLD_SET.has(v));
}

/**
 * Canonical Year of Study values for new submissions.
 * Labels: First Year, Sophomore
 * Legacy values (1st Year, 2nd Year) still recognized for display / soft migration.
 */
export const YEAR_OF_STUDY_FIRST = "First Year";
export const YEAR_OF_STUDY_SOPHOMORE = "Sophomore";

export const ALLOWED_YEAR_OF_STUDY = [YEAR_OF_STUDY_FIRST, YEAR_OF_STUDY_SOPHOMORE];

/** Map legacy stored values → canonical for new saves */
export const YEAR_OF_STUDY_LEGACY_MAP = {
  "1st Year": YEAR_OF_STUDY_FIRST,
  "First Year": YEAR_OF_STUDY_FIRST,
  "2nd Year": YEAR_OF_STUDY_SOPHOMORE,
  Sophomore: YEAR_OF_STUDY_SOPHOMORE,
};

export function normalizeYearOfStudy(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return YEAR_OF_STUDY_LEGACY_MAP[raw] || raw;
}

export function isAllowedYearOfStudy(value) {
  const canonical = normalizeYearOfStudy(value);
  return ALLOWED_YEAR_OF_STUDY.includes(canonical);
}

export function isValidWhatsAppGroupUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return true; // empty allowed
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    if (host === "chat.whatsapp.com" || host === "www.chat.whatsapp.com") {
      return u.pathname.length > 1;
    }
    if (host === "wa.me" || host === "api.whatsapp.com") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
