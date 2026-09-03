import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  GENDER_VALUES,
  formatGenderLabel,
  isValidGender,
  normalizeGender,
  normalizeDemographicsFields,
  validateDemographicsForSubmit,
} from "../lib/applicant-demographics.js";
import {
  GHANA_REGIONS,
  GHANA_REGION_COUNT,
  isCanonicalGhanaRegion,
} from "../lib/ghana-regions.js";
import {
  GHANA_TERTIARY_INSTITUTIONS,
  findCanonicalTertiaryInstitution,
  normalizeUniversityForStorage,
} from "../lib/ghana-tertiary-institutions.js";
import {
  validatePersonalInfo,
  validateAcademicInfo,
  validateForSubmit,
} from "../lib/application-validation.js";
import { STAGE1_ALLOWED_FIELDS } from "../lib/stage1-application-payload.js";

test("gender accepts only male and female canonical values", () => {
  assert.deepEqual([...GENDER_VALUES], ["male", "female"]);
  assert.equal(isValidGender("male"), true);
  assert.equal(isValidGender("female"), true);
  assert.equal(isValidGender("Male"), true);
  assert.equal(normalizeGender("FEMALE"), "female");
  assert.equal(normalizeGender("prefer_not_to_say"), null);
  assert.equal(normalizeGender("other"), null);
  assert.equal(normalizeGender("nonbinary"), null);
  assert.equal(normalizeGender(""), null);
  assert.equal(formatGenderLabel("male"), "Male");
  assert.equal(formatGenderLabel("female"), "Female");
  assert.equal(formatGenderLabel(null), "");
});

test("validateDemographics rejects invalid gender and missing gender", () => {
  assert.match(validateDemographicsForSubmit({}).gender, /required/i);
  assert.match(
    validateDemographicsForSubmit({ gender: "other", region: "Ashanti", university: "University of Ghana" })
      .gender || "",
    /required|Male|Female/i
  );
  assert.equal(
    validateDemographicsForSubmit({
      gender: "male",
      region: "Ashanti",
      university: "University of Ghana",
    }).gender,
    undefined
  );
});

test("Ghana regions are exactly 16 canonical values", () => {
  assert.equal(GHANA_REGION_COUNT, 16);
  assert.equal(GHANA_REGIONS.length, 16);
  for (const region of GHANA_REGIONS) {
    assert.equal(isCanonicalGhanaRegion(region), true);
  }
  assert.equal(isCanonicalGhanaRegion("Greater Accra"), true);
  assert.equal(isCanonicalGhanaRegion("North East"), true);
  assert.equal(isCanonicalGhanaRegion("Western North"), true);
  assert.equal(isCanonicalGhanaRegion("Ashanti Region"), false);
  assert.equal(isCanonicalGhanaRegion("Accra"), false);
  assert.equal(isCanonicalGhanaRegion(""), false);
});

test("personal validation requires gender and canonical region", () => {
  const base = {
    full_name: "Test Applicant",
    date_of_birth: "2005-01-15",
    phone: "+233200000000",
    address: "Accra",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    has_dual_citizenship: false,
    emergency_contact_name: "Parent",
    emergency_contact_number: "+233200000001",
    linkedin_url: "https://www.linkedin.com/in/test-applicant",
  };
  const missing = validatePersonalInfo(base);
  assert.match(missing.gender, /required/i);
  assert.match(missing.region, /required/i);

  const badRegion = validatePersonalInfo({
    ...base,
    gender: "male",
    region: "Ashanti Region",
  });
  assert.match(badRegion.region, /valid Ghana region/i);

  const ok = validatePersonalInfo({
    ...base,
    gender: "female",
    region: "Greater Accra",
  });
  assert.equal(ok.gender, undefined);
  assert.equal(ok.region, undefined);
});

test("university stores canonical names and accepts Other free text", () => {
  assert.ok(GHANA_TERTIARY_INSTITUTIONS.length >= 40);
  assert.equal(
    findCanonicalTertiaryInstitution("university of ghana"),
    "University of Ghana"
  );
  assert.equal(
    normalizeUniversityForStorage("  University of Ghana  "),
    "University of Ghana"
  );
  assert.equal(
    normalizeUniversityForStorage("  My Custom College  "),
    "My Custom College"
  );
  assert.equal(normalizeUniversityForStorage("   "), "");

  const empty = validateAcademicInfo({
    junior_high_school: "JHS",
    senior_high_school: "SHS",
    university: "  ",
    program: "BSc CS",
    year_of_study: "First Year",
    grade_type: "CGPA",
    gpa: "3.5",
    confirms_ghana_enrollment: true,
  });
  assert.match(empty.university, /required/i);

  const ok = validateAcademicInfo({
    junior_high_school: "JHS",
    senior_high_school: "SHS",
    university: "Ashesi University",
    program: "BSc CS",
    year_of_study: "First Year",
    grade_type: "CGPA",
    gpa: "3.5",
    confirms_ghana_enrollment: true,
  });
  assert.equal(ok.university, undefined);
});

test("legacy NULL gender remains readable and does not crash formatters", () => {
  const normalized = normalizeDemographicsFields({
    gender: null,
    region: "Ashanti Region",
    university: "UG",
  });
  assert.equal(normalized.gender, null);
  assert.equal(normalized.region, "Ashanti Region");
  assert.equal(normalized.university, "UG");
  assert.equal(formatGenderLabel(normalized.gender), "");
});

test("final submit rejects missing demographics", () => {
  const errors = validateForSubmit({
    full_name: "Test",
    date_of_birth: "2005-01-15",
    phone: "+233200000000",
    address: "Accra",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    has_dual_citizenship: false,
    emergency_contact_name: "P",
    emergency_contact_number: "1",
    linkedin_url: "https://www.linkedin.com/in/test",
    junior_high_school: "JHS",
    senior_high_school: "SHS",
    university: "University of Ghana",
    program: "Law",
    year_of_study: "First Year",
    grade_type: "GPA",
    gpa: "3.2",
    confirms_ghana_enrollment: true,
    cv_personal_statement_url: "u/a/cv.pdf",
    academic_transcript_url: "u/a/t.pdf",
    recommendation_urls: ["u/a/r1.pdf", "u/a/r2.pdf"],
    photo_url: "https://example.com/p.jpg",
    student_id_path: "u/a/id.pdf",
    ksp_tiktok_follow_screenshot_path: "u/a/tt.png",
    ksp_linkedin_follow_screenshot_path: "u/a/li.png",
    ksp_instagram_follow_screenshot_path: "u/a/ig.png",
    concept_note_title: "My Concept Note Title",
    concept_note_path: "u/a/note.pdf",
  });
  assert.match(errors.gender, /required/i);
  assert.match(errors.region, /required/i);
});

test("stage1 payload allowlist and forms include gender", () => {
  assert.ok(STAGE1_ALLOWED_FIELDS.includes("gender"));
  const personal = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/PersonalInfo.jsx"),
    "utf8"
  );
  assert.match(personal, /Gender/);
  assert.match(personal, /GHANA_REGIONS/);
  assert.doesNotMatch(personal, /placeholder="e\.g\. Ashanti Region"/);

  const academic = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/AcademicInfo.jsx"),
    "utf8"
  );
  assert.match(academic, /InstitutionSelect/);

  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  assert.match(review, /formatGenderLabel/);
  assert.match(review, /University \/ Institution/);
});

test("migration for gender is additive and nullable", () => {
  const path = resolve("supabase/migrations/202609030001_applications_gender.sql");
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS gender text/i);
  assert.match(sql, /gender IS NULL OR gender IN \('male', 'female'\)/);
  assert.doesNotMatch(sql, /NOT NULL/);
  assert.doesNotMatch(sql, /UPDATE public\.applications/i);
});

test("submit-stage1 normalizes demographics server-side", () => {
  const src = readFileSync(resolve("app/api/applications/submit-stage1/route.js"), "utf8");
  assert.match(src, /normalizeDemographicsFields/);
  assert.match(src, /validateForSubmit/);
});
