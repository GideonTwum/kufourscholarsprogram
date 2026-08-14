import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validatePersonalInfo,
  validateAcademicInfo,
  validateDocuments,
  validateStage2Video,
  normalizeDualCitizenshipFields,
  MAX_FILE_SIZE_PHOTO,
  GRADE_TYPES,
} from "../lib/application-validation.js";
import {
  isAllowedAfricanCountrySelect,
  isAllowedYearOfStudy,
  normalizeYearOfStudy,
  YEAR_OF_STUDY_FIRST,
  YEAR_OF_STUDY_SOPHOMORE,
  isValidWhatsAppGroupUrl,
} from "../lib/countries.js";
import { sanitizeStage1ApplicationData } from "../lib/stage1-application-payload.js";
import { evaluateEligibilityForAutoReject } from "../lib/eligibility-server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function basePersonal(overrides = {}) {
  return {
    full_name: "Ama Mensah",
    date_of_birth: "2005-01-15",
    phone: "+233201234567",
    address: "Accra",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    has_dual_citizenship: false,
    second_citizenship_country: null,
    emergency_contact_name: "Kojo Mensah",
    emergency_contact_number: "+233201111111",
    emergency_contact_2_name: "Abena Mensah",
    emergency_contact_2_number: "+233202222222",
    linkedin_url: "https://www.linkedin.com/in/ama-mensah",
    ...overrides,
  };
}

function baseAcademic(overrides = {}) {
  return {
    junior_high_school: "Accra JHS",
    senior_high_school: "Accra Academy",
    university: "University of Ghana",
    program: "BSc Computer Science",
    year_of_study: YEAR_OF_STUDY_FIRST,
    grade_type: "CWA",
    gpa: "72.5",
    confirms_ghana_enrollment: true,
    ...overrides,
  };
}

test("Country of Origin: required and valid African dropdown values accepted", () => {
  assert.equal(isAllowedAfricanCountrySelect("Ghana"), true);
  assert.equal(isAllowedAfricanCountrySelect("Narnia"), false);
  const missing = validatePersonalInfo(basePersonal({ country_of_origin: "" }));
  assert.ok(missing.country_of_origin);
  const bad = validatePersonalInfo(basePersonal({ country_of_origin: "Canada" }));
  assert.ok(bad.country_of_origin);
  const ok = validatePersonalInfo(basePersonal({ country_of_origin: "Nigeria" }));
  assert.equal(ok.country_of_origin, undefined);
});

test("Dual citizenship: No clears second country; Yes requires second country", () => {
  const cleared = normalizeDualCitizenshipFields({
    has_dual_citizenship: false,
    second_citizenship_country: "Canada",
    year_of_study: "1st Year",
  });
  assert.equal(cleared.has_dual_citizenship, false);
  assert.equal(cleared.second_citizenship_country, null);

  const needSecond = validatePersonalInfo(
    basePersonal({ has_dual_citizenship: true, second_citizenship_country: "" })
  );
  assert.ok(needSecond.second_citizenship_country);

  const sameCountry = validatePersonalInfo(
    basePersonal({
      has_dual_citizenship: true,
      country_of_origin: "Ghana",
      second_citizenship_country: "Ghana",
    })
  );
  assert.ok(sameCountry.second_citizenship_country);

  const dualOk = validatePersonalInfo(
    basePersonal({
      has_dual_citizenship: true,
      second_citizenship_country: "Canada",
    })
  );
  assert.equal(dualOk.second_citizenship_country, undefined);
  assert.equal(dualOk.has_dual_citizenship, undefined);
});

test("Year of Study: First Year and Sophomore accepted; advanced years rejected", () => {
  assert.equal(normalizeYearOfStudy("1st Year"), YEAR_OF_STUDY_FIRST);
  assert.equal(normalizeYearOfStudy("2nd Year"), YEAR_OF_STUDY_SOPHOMORE);
  assert.equal(isAllowedYearOfStudy("First Year"), true);
  assert.equal(isAllowedYearOfStudy("Sophomore"), true);
  assert.equal(isAllowedYearOfStudy("1st Year"), true);
  assert.equal(isAllowedYearOfStudy("2nd Year"), true);
  assert.equal(isAllowedYearOfStudy("3rd Year"), false);
  assert.equal(isAllowedYearOfStudy("4th Year"), false);
  assert.equal(isAllowedYearOfStudy("Postgraduate"), false);

  assert.equal(validateAcademicInfo(baseAcademic({ year_of_study: "First Year" })).year_of_study, undefined);
  assert.equal(validateAcademicInfo(baseAcademic({ year_of_study: "Sophomore" })).year_of_study, undefined);
  assert.ok(validateAcademicInfo(baseAcademic({ year_of_study: "3rd Year" })).year_of_study);
  assert.ok(validateAcademicInfo(baseAcademic({ year_of_study: "4th Year" })).year_of_study);

  const eligBad = evaluateEligibilityForAutoReject({
    ...basePersonal(),
    ...baseAcademic({ year_of_study: "3rd Year" }),
    cv_personal_statement_url: "a.pdf",
    academic_transcript_url: "b.pdf",
    recommendation_url: "c.pdf",
    photo_url: "photo.jpg",
    leadership_evidence_urls: ["lead.pdf"],
  });
  assert.equal(eligBad.ok, false);
  assert.match(eligBad.reason, /First Year|Sophomore/i);
});

test("Academic: JHS/SHS required; Grade Type unchanged", () => {
  assert.deepEqual(GRADE_TYPES, ["CWA", "CGPA", "GPA"]);
  assert.ok(validateAcademicInfo(baseAcademic({ junior_high_school: "" })).junior_high_school);
  assert.ok(validateAcademicInfo(baseAcademic({ senior_high_school: "" })).senior_high_school);

  const academicSrc = readFileSync(
    join(root, "app/(applicant)/applicant/application/steps/AcademicInfo.jsx"),
    "utf8"
  );
  assert.match(academicSrc, /Junior High School Attended[\s\S]*text-red-500">\*<\/span>/);
  assert.match(academicSrc, /Senior High School Attended[\s\S]*text-red-500">\*<\/span>/);
  assert.match(academicSrc, /University \/ Institution[\s\S]*text-red-500">\*<\/span>/);
  assert.match(academicSrc, /Program \/ Course[\s\S]*text-red-500">\*<\/span>/);
  assert.match(academicSrc, /Year of Study[\s\S]*text-red-500">\*<\/span>/);
  assert.match(academicSrc, /Grade type[\s\S]*text-red-500">\*<\/span>/);
});

test("Photo: 5MB limit", () => {
  assert.equal(MAX_FILE_SIZE_PHOTO, 5 * 1024 * 1024);
  const docs = validateDocuments({
    cv_personal_statement_url: "a.pdf",
    academic_transcript_url: "b.pdf",
    leadership_evidence_urls: ["c.pdf"],
    recommendation_url: "d.pdf",
    photo_url: "photo.jpg",
  });
  assert.equal(docs.photo_url, undefined);
  assert.match(
    validateDocuments({
      cv_personal_statement_url: "a.pdf",
      academic_transcript_url: "b.pdf",
      leadership_evidence_urls: ["c.pdf"],
      recommendation_url: "d.pdf",
      photo_url: "",
    }).photo_url,
    /5MB/
  );

  const documentsSrc = readFileSync(
    join(root, "app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  assert.match(documentsSrc, /max 5MB/);
  assert.doesNotMatch(documentsSrc, /max 2MB/);
});

test("Stage 2: instructions and required confirmations", () => {
  const stage2Src = readFileSync(join(root, "app/(applicant)/applicant/stage2/page.js"), "utf8");
  assert.match(stage2Src, /concept note/i);
  assert.match(stage2Src, /KSP Application/);
  assert.match(stage2Src, /public/i);
  assert.doesNotMatch(stage2Src, /unlisted is fine/i);

  assert.ok(
    validateStage2Video({
      video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
    }).confirms_youtube_public
  );
  assert.equal(
    Object.keys(
      validateStage2Video({
        video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
        confirms_youtube_public: true,
        confirms_youtube_title_format: true,
        confirms_youtube_description_concept: true,
      })
    ).length,
    0
  );
});

test("Acceptance UI: congratulations, WhatsApp only when configured, reduced-motion confetti", () => {
  const dash = readFileSync(join(root, "app/(applicant)/applicant/page.js"), "utf8");
  assert.match(dash, /Congratulations/);
  assert.match(dash, /accepted into the Kufuor Scholars Program/);
  assert.match(dash, /Join the Scholars WhatsApp Group/);
  assert.match(dash, /accepted_whatsapp_group_url/);
  assert.match(dash, /prefers-reduced-motion/);
  assert.match(dash, /status === "accepted"/);
});

test("WhatsApp URL validation and settings allowlist", () => {
  assert.equal(isValidWhatsAppGroupUrl(""), true);
  assert.equal(isValidWhatsAppGroupUrl("https://chat.whatsapp.com/AbCdEf123"), true);
  assert.equal(isValidWhatsAppGroupUrl("https://evil.com/x"), false);

  const settingsSrc = readFileSync(join(root, "app/api/director/settings/route.js"), "utf8");
  assert.match(settingsSrc, /accepted_whatsapp_group_url/);
  assert.match(settingsSrc, /application_cohort_year/);
  assert.match(settingsSrc, /isValidWhatsAppGroupUrl/);
});

test("Stage 1 payload allowlist includes dual citizenship fields", () => {
  const { data } = sanitizeStage1ApplicationData({
    has_dual_citizenship: true,
    second_citizenship_country: "Canada",
    status: "accepted",
  });
  assert.equal(data.has_dual_citizenship, true);
  assert.equal(data.second_citizenship_country, "Canada");
  assert.equal(data.status, undefined);
});

test("Email verification wording uses confirmation link (not typed OTP)", () => {
  const verify = readFileSync(
    join(root, "app/(applicant)/applicant/verify-email/page.js"),
    "utf8"
  );
  assert.match(verify, /Check your email/);
  assert.match(verify, /verification link/i);
  assert.doesNotMatch(verify, /\bOTP\b/);
});

test("About/Legacy uses John Agyekum Kufuor", () => {
  const about = readFileSync(join(root, "components/landing/About.jsx"), "utf8");
  assert.match(about, /John Agyekum Kufuor/);
  const aboutPage = readFileSync(join(root, "app/(public)/about/page.js"), "utf8");
  assert.match(aboutPage, /John Agyekum/);
});
