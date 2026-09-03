/**
 * Maintainable list of Ghanaian tertiary institutions for Stage 1 selection.
 * Canonical display names are stored in applications.university when selected.
 */

export const OTHER_INSTITUTION_OPTION = "Other institution / Not listed";

/** Sentinel for UI select value only — never persisted to the database. */
export const OTHER_INSTITUTION_SELECT_VALUE = "__other_institution__";

export const GHANA_TERTIARY_INSTITUTIONS = Object.freeze([
  // Public universities
  "University of Ghana",
  "Kwame Nkrumah University of Science and Technology",
  "University of Cape Coast",
  "University of Education, Winneba",
  "University for Development Studies",
  "University of Mines and Technology",
  "University of Health and Allied Sciences",
  "University of Energy and Natural Resources",
  "University of Professional Studies, Accra",
  "Ghana Institute of Management and Public Administration",
  "University of Environment and Sustainable Development",
  "C.K. Tedam University of Technology and Applied Sciences",
  "Simon Diedong Dombo University of Business and Integrated Development Studies",
  "Akenten Appiah-Menka University of Skills Training and Entrepreneurial Development",
  // Technical universities
  "Accra Technical University",
  "Kumasi Technical University",
  "Takoradi Technical University",
  "Cape Coast Technical University",
  "Ho Technical University",
  "Koforidua Technical University",
  "Sunyani Technical University",
  "Tamale Technical University",
  "Bolgatanga Technical University",
  "Wa Technical University",
  // Chartered / major private universities
  "Ashesi University",
  "Central University",
  "Valley View University",
  "Pentecost University",
  "Methodist University Ghana",
  "Presbyterian University, Ghana",
  "Catholic University of Ghana",
  "Christian Service University",
  "All Nations University",
  "Regent University College of Science and Technology",
  "Ghana Christian University College",
  "Wisconsin International University College",
  "Academic City University College",
  "Lancaster University Ghana",
  "Webster University Ghana",
  "University of Applied Management",
  "African University College of Communications",
  "Ghana Technology University College",
  "Knutsford University College",
  "Maranatha University College",
  "Radford University College",
  "Zenith University College",
  "Data Link Institute of Business and Technology",
  "Ensign Global College",
  "BlueCrest University College",
  "Jayee University College",
  "KAAF University College",
  "Kings University College",
  "Mountcrest University College",
  "Perez University College",
  "Spiritual Life University College",
  "West End University College",
  "Yaa Asantewaa Women's University College of Education",
  // Specialized / public institutes
  "Ghana Armed Forces Command and Staff College",
  "Kofi Annan International Peacekeeping Training Centre",
  "Institute of Local Government Studies",
  "National Film and Television Institute",
  "Regional Maritime University",
  "Ghana Institute of Journalism",
  "Ghana Institute of Languages",
  "College of Health, Yamfo",
  // Colleges of Education (selection of major public CoEs)
  "Accra College of Education",
  "Ada College of Education",
  "Agogo Presbyterian College of Education",
  "Akatsi College of Education",
  "Akrokerri College of Education",
  "Atebubu College of Education",
  "Bagaboye College of Education",
  "Berekum College of Education",
  "Dambai College of Education",
  "Enchi College of Education",
  "Evangelical Presbyterian College of Education, Amedzofe",
  "Foso College of Education",
  "Gbewaa College of Education",
  "Holy Child College of Education",
  "Jasikan College of Education",
  "Kibi Presbyterian College of Education",
  "Komenda College of Education",
  "Mampong Technical College of Education",
  "Nusrat Jahan Ahmadiyya College of Education",
  "Offinso College of Education",
  "Ola College of Education",
  "Peki College of Education",
  "Presbyterian College of Education, Akropong",
  "Presbyterian Women's College of Education, Aburi",
  "SDA College of Education, Asokore",
  "St. Francis College of Education, Hohoe",
  "St. Joseph's College of Education, Bechem",
  "St. Louis College of Education",
  "St. Monica's College of Education",
  "St. Teresa's College of Education",
  "Tamale College of Education",
  "Tumu College of Education",
  "Wesley College of Education",
  "Wiawso College of Education",
  // Nursing & midwifery training colleges (major public NMTCs)
  "37 Military Hospital Nurses Training College",
  "Ankaful Nurses Training College",
  "Bolgatanga Nurses Training College",
  "Cape Coast Nursing and Midwifery Training College",
  "Ho Nurses Training College",
  "Koforidua Nurses Training College",
  "Korle Bu Nursing and Midwifery Training College",
  "Kumasi Nurses Training College",
  "Nurses Training College, Pantang",
  "Nurses and Midwifery Training College, Sekondi",
  "Nurses Training College, Tamale",
  "Presbyterian Nurses Training College, Agogo",
  "Sunyani Nurses Training College",
  "Wa Nurses Training College",
]);

const INSTITUTION_SET = new Set(GHANA_TERTIARY_INSTITUTIONS);
const INSTITUTION_LOOKUP = new Map(
  GHANA_TERTIARY_INSTITUTIONS.map((name) => [name.toLowerCase(), name])
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalTertiaryInstitution(value) {
  if (typeof value !== "string") return false;
  return INSTITUTION_SET.has(value.trim());
}

/**
 * If value matches a known institution (exact or case-insensitive), return canonical name.
 * Does not fuzzy-match abbreviations or aliases.
 * @param {unknown} value
 * @returns {string|null}
 */
export function findCanonicalTertiaryInstitution(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (INSTITUTION_SET.has(trimmed)) return trimmed;
  return INSTITUTION_LOOKUP.get(trimmed.toLowerCase()) || null;
}

/**
 * Normalize university for persistence.
 * Known institutions → canonical display name.
 * Other → trimmed applicant text (preserve capitalization).
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeUniversityForStorage(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return findCanonicalTertiaryInstitution(trimmed) || trimmed;
}
