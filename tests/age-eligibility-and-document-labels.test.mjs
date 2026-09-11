import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGE_ELIGIBILITY_MESSAGE,
  MAX_APPLICANT_AGE,
  NATIONAL_ID_LABEL,
  PASSPORT_PICTURE_LABEL,
  ageInYearsOnDateOfBirth,
  isAgeEligible,
  validatePersonalInfo,
  validateDocuments,
} from "../lib/application-validation.js";
import { evaluateEligibilityForAutoReject } from "../lib/eligibility-server.js";

const REF = new Date(2026, 7, 24); // 24 Aug 2026

test("canonical max age is 23 inclusive", () => {
  assert.equal(MAX_APPLICANT_AGE, 23);
  assert.equal(AGE_ELIGIBILITY_MESSAGE, "Applicants must be 23 years old or younger to be eligible.");
});

test("birthday-aware age: still 23 the day before 24th birthday", () => {
  // DOB 25 Aug 2002 on 24 Aug 2026 → 23
  assert.equal(ageInYearsOnDateOfBirth("2002-08-25", REF), 23);
  assert.equal(isAgeEligible("2002-08-25", REF), true);
});

test("birthday-aware age: turns 24 on/after birthday", () => {
  // DOB 23 Aug 2002 on 24 Aug 2026 → 24
  assert.equal(ageInYearsOnDateOfBirth("2002-08-23", REF), 24);
  assert.equal(isAgeEligible("2002-08-23", REF), false);
  // DOB 24 Aug 2002 on 24 Aug 2026 → exactly 24
  assert.equal(ageInYearsOnDateOfBirth("2002-08-24", REF), 24);
  assert.equal(isAgeEligible("2002-08-24", REF), false);
});

test("age 22 and 23 eligible; 24 rejected by client validation", () => {
  const age22 = validatePersonalInfo({
    full_name: "A",
    date_of_birth: "2004-08-24",
    phone: "1",
    address: "x",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    has_dual_citizenship: false,
    emergency_contact_name: "E",
    emergency_contact_number: "1",
    linkedin_url: "https://www.linkedin.com/in/test",
  });
  // Force ref via age helper; validatePersonalInfo uses now — use DOBs relative to "today"
  // Prefer explicit isAgeEligible + message path:
  assert.equal(isAgeEligible("2004-01-01", REF), true); // 22
  assert.equal(isAgeEligible("2003-08-24", REF), true); // 23 on birthday
  assert.equal(isAgeEligible("2002-08-24", REF), false); // 24

  const tooOld = validatePersonalInfo({
    full_name: "A",
    date_of_birth: "1990-01-01",
    phone: "1",
    address: "x",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    has_dual_citizenship: false,
    emergency_contact_name: "E",
    emergency_contact_number: "1",
    linkedin_url: "https://www.linkedin.com/in/test",
  });
  assert.equal(tooOld.date_of_birth, AGE_ELIGIBILITY_MESSAGE);
  assert.equal(age22.date_of_birth, undefined);
});

test("server auto-reject blocks age 24+ with shared message", () => {
  const base = {
    date_of_birth: "2002-08-23",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    year_of_study: "First Year",
    junior_high_school: "JHS",
    senior_high_school: "SHS",
    confirms_ghana_enrollment: true,
    cv_personal_statement_url: "a.pdf",
    academic_transcript_url: "b.pdf",
    wassce_results_urls: ["w.pdf"],
    recommendation_urls: ["r1.pdf", "r2.pdf"],
    photo_url: "https://example.com/p.jpg",
    student_id_path: "u/student-id/x.pdf",
    ksp_tiktok_follow_screenshot_path: "t.webp",
    ksp_linkedin_follow_screenshot_path: "l.png",
    ksp_instagram_follow_screenshot_path: "i.jpg",
    concept_note_title: "Improving Waste Management Among Households in Madina",
    concept_note_path: "u/concept-note/c.pdf",
    linkedin_url: "https://www.linkedin.com/in/test",
    emergency_contact_name: "E",
    emergency_contact_number: "+233200000001",
    grade_type: "CWA",
    gpa: "70",
  };
  // Age vs "now" — use a clearly old DOB for deterministic reject
  const rejected = evaluateEligibilityForAutoReject({ ...base, date_of_birth: "1995-01-01" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, AGE_ELIGIBILITY_MESSAGE);

  const young = evaluateEligibilityForAutoReject({ ...base, date_of_birth: "2005-01-15" });
  assert.equal(young.ok, true);
});

test("document validation uses Passport Picture and National ID labels", () => {
  const errors = validateDocuments({
    cv_personal_statement_url: "cv.pdf",
    academic_transcript_url: "t.pdf",
    wassce_results_urls: ["w.pdf"],
    recommendation_urls: ["a.pdf", "b.pdf"],
    photo_url: "",
    student_id_path: "",
    ksp_tiktok_follow_screenshot_path: "t.webp",
    ksp_linkedin_follow_screenshot_path: "l.png",
    ksp_instagram_follow_screenshot_path: "i.jpg",
  });
  assert.match(errors.photo_url, /Passport Picture/);
  assert.match(errors.student_id_path, /National ID/);
  assert.equal(PASSPORT_PICTURE_LABEL, "Passport Picture");
  assert.equal(NATIONAL_ID_LABEL, "National ID");
});

test("active applicant UI uses Passport Picture and National ID (not old labels)", () => {
  const docs = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  const personal = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/PersonalInfo.jsx"),
    "utf8"
  );
  assert.match(docs, /Passport Picture/);
  assert.match(docs, /National ID/);
  assert.doesNotMatch(docs, /Passport photograph/i);
  assert.doesNotMatch(docs, />\s*Student ID\s*</);
  assert.match(review, /Passport Picture/);
  assert.match(review, /View Passport Picture/);
  assert.match(review, /National ID/);
  assert.match(review, /View National ID/);
  assert.doesNotMatch(review, /Passport photograph/i);
  assert.doesNotMatch(review, /View Student ID/);
  assert.match(personal, /AGE_ELIGIBILITY_MESSAGE/);
});

test("Director Assessor Panel use Passport Picture and National ID labels", () => {
  const director = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  const assessor = readFileSync(resolve("app/(dashboard)/assessor/[id]/page.js"), "utf8");
  const panel = readFileSync(resolve("app/(dashboard)/panel/[id]/page.js"), "utf8");
  for (const src of [director, assessor, panel]) {
    assert.match(src, /Passport Picture/);
    assert.match(src, /National ID/);
    assert.doesNotMatch(src, /Passport \/ profile photo/);
  }
  // Legacy internal field retained
  assert.match(director, /student_id_path/);
  assert.match(assessor, /student_id_path/);
});

test("public eligibility copy references 23 years or younger", () => {
  const apply = readFileSync(resolve("app/(public)/apply/page.js"), "utf8");
  const faq = readFileSync(resolve("app/(public)/faq/page.js"), "utf8");
  const faqComp = readFileSync(resolve("components/landing/FAQ.jsx"), "utf8");
  assert.match(apply, /23 years or younger/);
  assert.doesNotMatch(apply, /25 or under/);
  assert.match(faq, /23 years or younger/);
  assert.match(faqComp, /23 years or younger/);
});

test("legacy student_id_path still validated as National ID storage field", () => {
  assert.equal(
    validateDocuments({
      cv_personal_statement_url: "cv.pdf",
      academic_transcript_url: "t.pdf",
      wassce_results_urls: ["w.pdf"],
      recommendation_urls: ["a.pdf", "b.pdf"],
      photo_url: "https://example.com/p.jpg",
      student_id_path: "user/student-id/legacy.pdf",
      ksp_tiktok_follow_screenshot_path: "t.webp",
      ksp_linkedin_follow_screenshot_path: "l.png",
      ksp_instagram_follow_screenshot_path: "i.jpg",
    }).student_id_path,
    undefined
  );
});
