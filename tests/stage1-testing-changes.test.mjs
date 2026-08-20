import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CV_PERSONAL_STATEMENT_HINT,
  KSP_SOCIAL_HANDLES,
  MIN_RECOMMENDATION_LETTERS,
  getRecommendationLetterPaths,
  validateDocuments,
  validateForSubmit,
  validatePersonalInfo,
} from "../lib/application-validation.js";
import { evaluateEligibilityForAutoReject } from "../lib/eligibility-server.js";
import { sanitizeStage1ApplicationData } from "../lib/stage1-application-payload.js";
import { prefersReducedMotion, scrollStage1ContentToTop } from "../lib/stage1-scroll.js";

function basePersonal(overrides = {}) {
  return {
    full_name: "Test Applicant",
    date_of_birth: "2005-01-15",
    phone: "+233200000000",
    address: "Accra",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    has_dual_citizenship: false,
    emergency_contact_name: "Parent One",
    emergency_contact_number: "+233200000001",
    linkedin_url: "https://www.linkedin.com/in/test-applicant",
    ...overrides,
  };
}

function baseAcademic(overrides = {}) {
  return {
    junior_high_school: "JHS Example",
    senior_high_school: "SHS Example",
    university: "University of Ghana",
    program: "Economics",
    year_of_study: "First Year",
    grade_type: "CGPA",
    gpa: "3.5",
    confirms_ghana_enrollment: true,
    ...overrides,
  };
}

function baseDocs(overrides = {}) {
  return {
    cv_personal_statement_url: "user/cv/a.pdf",
    academic_transcript_url: "user/transcript/a.pdf",
    recommendation_urls: ["user/recommendation/1.pdf", "user/recommendation/2.pdf"],
    photo_url: "https://example.com/photo.jpg",
    student_id_path: "user/student-id/id.pdf",
    ksp_tiktok_follow_screenshot_path: "user/social/tiktok.webp",
    ksp_linkedin_follow_screenshot_path: "user/social/linkedin.png",
    ksp_instagram_follow_screenshot_path: "user/social/instagram.jpg",
    concept_note_title: "Improving Waste Management Among Households in Madina",
    concept_note_path: "user/concept-note/a.pdf",
    ...overrides,
  };
}

function baseValid(overrides = {}) {
  return {
    ...basePersonal(),
    ...baseAcademic(),
    ...baseDocs(),
    ...overrides,
  };
}

test("Personal Statement guidance includes mentorship/coaching needs", () => {
  assert.match(CV_PERSONAL_STATEMENT_HINT, /mentorship/i);
  assert.match(CV_PERSONAL_STATEMENT_HINT, /coaching/i);
  assert.match(CV_PERSONAL_STATEMENT_HINT, /leadership/i);
  const docsUi = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  assert.match(docsUi, /CV_PERSONAL_STATEMENT_HINT/);
  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  assert.match(review, /CV_PERSONAL_STATEMENT_HINT/);
});

test("KSP social handles are exact official accounts", () => {
  assert.equal(KSP_SOCIAL_HANDLES.tiktok, "@kufuorscholars");
  assert.equal(KSP_SOCIAL_HANDLES.linkedin, "Kufuor Scholars Program");
  assert.equal(KSP_SOCIAL_HANDLES.instagram, "@kufuor_scholars_program");
  const docsUi = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  assert.match(docsUi, /Follow KSP on Social Media/);
  assert.match(docsUi, /@kufuorscholars/);
  assert.match(docsUi, /Kufuor Scholars Program/);
  assert.match(docsUi, /@kufuor_scholars_program/);
  assert.doesNotMatch(docsUi, /Visit KSP Account/);
});

test("social screenshots: missing one blocks; all three pass", () => {
  const missingTiktok = validateDocuments(
    baseDocs({ ksp_tiktok_follow_screenshot_path: "" })
  );
  assert.match(missingTiktok.ksp_tiktok_follow_screenshot_path, /TikTok/);

  const missingLinkedin = validateDocuments(
    baseDocs({ ksp_linkedin_follow_screenshot_path: "" })
  );
  assert.match(missingLinkedin.ksp_linkedin_follow_screenshot_path, /LinkedIn/);

  const missingIg = validateDocuments(
    baseDocs({ ksp_instagram_follow_screenshot_path: "" })
  );
  assert.match(missingIg.ksp_instagram_follow_screenshot_path, /Instagram/);

  assert.deepEqual(validateDocuments(baseDocs()), {});
});

test("Student ID document is required", () => {
  const missing = validateDocuments(baseDocs({ student_id_path: "" }));
  assert.match(missing.student_id_path, /Student ID/);
  assert.equal(validateDocuments(baseDocs()).student_id_path, undefined);
});

test("Evidence of Leadership is optional", () => {
  const without = validateDocuments(baseDocs({ leadership_evidence_urls: [] }));
  assert.equal(without.leadership_evidence_urls, undefined);
  const withFile = validateDocuments(
    baseDocs({ leadership_evidence_urls: ["user/leadership/a.pdf"] })
  );
  assert.deepEqual(withFile, {});
  const docsUi = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  assert.match(docsUi, /Optional — upload if available/);
});

test("Emergency Contact 1 required; Contact 2 optional / partial-fill validated", () => {
  assert.ok(validatePersonalInfo(basePersonal({ emergency_contact_name: "" })).emergency_contact_name);
  assert.ok(
    validatePersonalInfo(basePersonal({ emergency_contact_number: "" })).emergency_contact_number
  );
  assert.deepEqual(
    Object.keys(
      validatePersonalInfo(
        basePersonal({
          emergency_contact_2_name: "",
          emergency_contact_2_number: "",
        })
      )
    ).filter((k) => k.startsWith("emergency_contact_2")),
    []
  );
  const partial = validatePersonalInfo(
    basePersonal({
      emergency_contact_2_name: "Auntie",
      emergency_contact_2_number: "",
    })
  );
  assert.ok(partial.emergency_contact_2_number);
  const personalUi = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/PersonalInfo.jsx"),
    "utf8"
  );
  assert.match(personalUi, /Emergency contact 2[\s\S]*\(Optional\)/);
  assert.doesNotMatch(
    personalUi,
    /Emergency contact 2 <span className="text-red-500">\*<\/span>/
  );
});

test("Recommendation letters require minimum two; three+ allowed", () => {
  assert.equal(MIN_RECOMMENDATION_LETTERS, 2);
  assert.match(
    validateDocuments(baseDocs({ recommendation_urls: [] })).recommendation_urls,
    /at least two/i
  );
  assert.match(
    validateDocuments(baseDocs({ recommendation_urls: ["user/rec/1.pdf"] })).recommendation_urls,
    /at least two/i
  );
  assert.equal(
    validateDocuments(
      baseDocs({ recommendation_urls: ["user/rec/1.pdf", "user/rec/2.pdf"] })
    ).recommendation_urls,
    undefined
  );
  assert.equal(
    validateDocuments(
      baseDocs({
        recommendation_urls: ["user/rec/1.pdf", "user/rec/2.pdf", "user/rec/3.pdf"],
      })
    ).recommendation_urls,
    undefined
  );
});

test("historical single recommendation_url still loads via getRecommendationLetterPaths", () => {
  const paths = getRecommendationLetterPaths({
    recommendation_url: "user/recommendation/legacy.pdf",
  });
  assert.deepEqual(paths, ["user/recommendation/legacy.pdf"]);
  // New submissions still reject a single letter
  assert.ok(validateDocuments(baseDocs({ recommendation_urls: undefined, recommendation_url: "user/recommendation/legacy.pdf" })).recommendation_urls);
});

test("validateForSubmit and eligibility enforce Stage 1 testing rules", () => {
  assert.deepEqual(validateForSubmit(baseValid()), {});
  assert.equal(evaluateEligibilityForAutoReject(baseValid()).ok, true);

  const noLeadership = baseValid({ leadership_evidence_urls: [] });
  assert.deepEqual(validateForSubmit(noLeadership), {});
  assert.equal(evaluateEligibilityForAutoReject(noLeadership).ok, true);

  const oneRec = baseValid({ recommendation_urls: ["only-one.pdf"] });
  assert.ok(validateForSubmit(oneRec).recommendation_urls);
  assert.equal(evaluateEligibilityForAutoReject(oneRec).ok, false);

  const noStudentId = baseValid({ student_id_path: "" });
  assert.ok(validateForSubmit(noStudentId).student_id_path);
  assert.equal(evaluateEligibilityForAutoReject(noStudentId).ok, false);
});

test("payload allowlists new Stage 1 fields", () => {
  const { data } = sanitizeStage1ApplicationData({
    student_id_path: "u/id.pdf",
    recommendation_urls: ["a.pdf", "b.pdf"],
    ksp_tiktok_follow_screenshot_path: "t.webp",
    ksp_linkedin_follow_screenshot_path: "l.png",
    ksp_instagram_follow_screenshot_path: "i.jpg",
    status: "accepted",
  });
  assert.equal(data.student_id_path, "u/id.pdf");
  assert.deepEqual(data.recommendation_urls, ["a.pdf", "b.pdf"]);
  assert.equal(data.ksp_tiktok_follow_screenshot_path, "t.webp");
  assert.equal(data.status, undefined);
});

test("migration adds Stage 1 testing columns", () => {
  const path = resolve("supabase/migrations/202608200001_stage1_testing_changes.sql");
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /student_id_path/);
  assert.match(sql, /ksp_tiktok_follow_screenshot_path/);
  assert.match(sql, /ksp_linkedin_follow_screenshot_path/);
  assert.match(sql, /ksp_instagram_follow_screenshot_path/);
  assert.match(sql, /recommendation_urls/);
  assert.match(sql, /jsonb_build_array\(recommendation_url\)/);
});

test("Save & Continue scrolls dashboard-content; respects reduced motion", () => {
  const scrollSrc = readFileSync(resolve("lib/stage1-scroll.js"), "utf8");
  assert.match(scrollSrc, /main\.dashboard-content/);
  assert.match(scrollSrc, /prefers-reduced-motion/);
  assert.match(scrollSrc, /behavior.*auto.*smooth|behavior = reduced/);

  const app = readFileSync(resolve("app/(applicant)/applicant/application/page.js"), "utf8");
  assert.match(app, /scrollStage1ContentToTop/);
  assert.match(app, /handleNext[\s\S]*scrollStage1ContentToTop/);
  assert.match(app, /Object\.keys\(stepErrors\)\.length > 0[\s\S]*return;/);

  // Node smoke: helpers exist and do not throw without DOM
  assert.equal(typeof prefersReducedMotion, "function");
  assert.equal(typeof scrollStage1ContentToTop, "function");
  assert.equal(prefersReducedMotion(), false);
  assert.doesNotThrow(() => scrollStage1ContentToTop());
});

test("Director and Assessor surfaces include new Stage 1 evidence", () => {
  const director = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(director, /Student ID/);
  assert.match(director, /Recommendation Letter/);
  assert.match(director, /KSP Social Media Evidence/);
  assert.match(director, /@kufuorscholars/);

  const assessor = readFileSync(resolve("app/(dashboard)/assessor/[id]/page.js"), "utf8");
  assert.match(assessor, /Student ID/);
  assert.match(assessor, /Recommendation Letter/);
  assert.match(assessor, /KSP Social Media Evidence/);
  assert.match(assessor, /getRecommendationLetterPaths/);

  const workflow = readFileSync(resolve("lib/assessor-workflow.js"), "utf8");
  assert.match(workflow, /student_id_path/);
  assert.match(workflow, /recommendation_urls/);
  assert.match(workflow, /ksp_tiktok_follow_screenshot_path/);
});

test("submit-stage1 validates before success email path", () => {
  const route = readFileSync(resolve("app/api/applications/submit-stage1/route.js"), "utf8");
  assert.match(route, /validateForSubmit/);
  assert.match(route, /field_errors/);
  assert.match(route, /recommendation_urls/);
});

test("Review & Submit shows social evidence and optional leadership wording", () => {
  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  assert.match(review, /KSP Social Media Evidence/);
  assert.match(review, /View Student ID/);
  assert.match(review, /Not provided \(optional\)/);
  assert.match(review, /Recommendation Letter/);
});
