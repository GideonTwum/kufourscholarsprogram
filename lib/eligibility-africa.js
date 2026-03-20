/**
 * Eligibility: African nationality / country of origin.
 * Used to reject non-African entries in the application form.
 */

const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, "")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Human-entered country names → stored as normalize() output */
const AFRICAN_COUNTRY_RAW = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cape Verde",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo",
  "Republic of the Congo",
  "Côte d'Ivoire",
  "Ivory Coast",
  "Democratic Republic of the Congo",
  "DR Congo",
  "DRC",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Swaziland",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "The Gambia",
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
  "Sao Tome and Principe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "United Republic of Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
  "Western Sahara",
  "Saint Helena",
];

export const AFRICAN_COUNTRY_NORMALIZED = new Set(
  AFRICAN_COUNTRY_RAW.map((c) => normalize(c)).filter(Boolean)
);

/** Map compact typos → normalized keys already in AFRICAN_COUNTRY_NORMALIZED */
const ALIAS_TO_CANONICAL = {
  cotedivoire: "cote divoire",
};

const DEMONYN_RAW = [
  "Algerian",
  "Angolan",
  "Beninese",
  "Botswanan",
  "Burkinabe",
  "Burundian",
  "Cape Verdean",
  "Cape Verdean",
  "Cameroonian",
  "Central African",
  "Chadian",
  "Comoran",
  "Comorian",
  "Congolese",
  "Ivorian",
  "Djiboutian",
  "Egyptian",
  "Equatorial Guinean",
  "Eritrean",
  "Swazi",
  "Ethiopian",
  "Gabonese",
  "Gambian",
  "Ghanaian",
  "Guinean",
  "Bissau-Guinean",
  "Kenyan",
  "Basotho",
  "Mosotho",
  "Liberian",
  "Libyan",
  "Malagasy",
  "Malawian",
  "Malian",
  "Mauritanian",
  "Mauritian",
  "Moroccan",
  "Mozambican",
  "Namibian",
  "Nigerien",
  "Nigerian",
  "Rwandan",
  "Santomean",
  "Senegalese",
  "Seychellois",
  "Sierra Leonean",
  "Somali",
  "South African",
  "South Sudanese",
  "Sudanese",
  "Tanzanian",
  "Togolese",
  "Tunisian",
  "Ugandan",
  "Zambian",
  "Zimbabwean",
  "Sahrawi",
  "Sahrawian",
  "African",
];

export const AFRICAN_DEMONYM_NORMALIZED = new Set([
  ...AFRICAN_COUNTRY_NORMALIZED,
  ...DEMONYN_RAW.map((c) => normalize(c)).filter(Boolean),
]);

function normalizedKey(input) {
  const n = normalize(input);
  if (!n) return "";
  return ALIAS_TO_CANONICAL[n] || n;
}

/**
 * True if value is a recognized African country (country of origin).
 */
export function isAfricanCountryOfOrigin(input) {
  const key = normalizedKey(input);
  if (!key) return false;
  return AFRICAN_COUNTRY_NORMALIZED.has(key);
}

/**
 * True if nationality / citizenship is African (country name or demonym).
 */
export function isAfricanNationality(input) {
  const key = normalizedKey(input);
  if (!key) return false;
  return AFRICAN_DEMONYM_NORMALIZED.has(key);
}
