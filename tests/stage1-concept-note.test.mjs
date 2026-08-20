import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONCEPT_NOTE_PAGE_COUNT_ENFORCED,
  CONCEPT_NOTE_TITLE_MAX,
  CONCEPT_NOTE_TITLE_MIN,
  normalizeConceptNoteTitle,
  validateConceptNote,
  validateForSubmit,
  validateStep,
} from "../lib/application-validation.js";
import { sanitizeStage1ApplicationData } from "../lib/stage1-application-payload.js";
import { evaluateEligibilityForAutoReject } from "../lib/eligibility-server.js";

const baseValid = {
  full_name: "Test Applicant",
  date_of_birth: "2005-01-15",
  phone: "+233200000000",
  address: "Accra",
  country_of_origin: "Ghana",
  nationality: "Ghanaian",
  has_dual_citizenship: false,
  emergency_contact_name: "Parent One",
  emergency_contact_number: "+233200000001",
  emergency_contact_2_name: "Parent Two",
  emergency_contact_2_number: "+233200000002",
  linkedin_url: "https://www.linkedin.com/in/test-applicant",
  junior_high_school: "JHS Example",
  senior_high_school: "SHS Example",
  university: "University of Ghana",
  program: "Economics",
  year_of_study: "First Year",
  grade_type: "CGPA",
  gpa: "3.5",
  confirms_ghana_enrollment: true,
  cv_personal_statement_url: "user/cv/a.pdf",
  academic_transcript_url: "user/transcript/a.pdf",
  leadership_evidence_urls: ["user/leadership/a.pdf"],
  recommendation_urls: ["user/recommendation/a.pdf", "user/recommendation/b.pdf"],
  photo_url: "https://example.com/photo.jpg",
  student_id_path: "user/student-id/id.pdf",
  ksp_tiktok_follow_screenshot_path: "user/social/tiktok.webp",
  ksp_linkedin_follow_screenshot_path: "user/social/linkedin.png",
  ksp_instagram_follow_screenshot_path: "user/social/instagram.jpg",
  concept_note_title: "Improving Waste Management Among Households in Madina",
  concept_note_path: "user/concept-note/a.pdf",
};

test("missing concept note title is invalid", () => {
  const errors = validateConceptNote({ concept_note_path: "user/concept-note/a.pdf" });
  assert.match(errors.concept_note_title, /required/i);
});

test("whitespace-only concept note title is invalid", () => {
  const errors = validateConceptNote({
    concept_note_title: "   ",
    concept_note_path: "user/concept-note/a.pdf",
  });
  assert.match(errors.concept_note_title, /required/i);
});

test("short concept note title is invalid", () => {
  const errors = validateConceptNote({
    concept_note_title: "Short",
    concept_note_path: "user/concept-note/a.pdf",
  });
  assert.match(errors.concept_note_title, /at least/i);
  assert.equal(CONCEPT_NOTE_TITLE_MIN, 8);
  assert.equal(CONCEPT_NOTE_TITLE_MAX, 200);
});

test("valid concept note title and PDF path are accepted", () => {
  const errors = validateConceptNote({
    concept_note_title: "Improving Waste Management Among Households in Madina",
    concept_note_path: "user/concept-note/note.pdf",
  });
  assert.deepEqual(errors, {});
});

test("missing concept note file blocks validation", () => {
  const errors = validateConceptNote({
    concept_note_title: "Improving Waste Management Among Households in Madina",
  });
  assert.match(errors.concept_note_path, /Upload/i);
});

test("non-PDF concept note path is rejected", () => {
  const errors = validateConceptNote({
    concept_note_title: "Improving Waste Management Among Households in Madina",
    concept_note_path: "user/concept-note/note.docx",
  });
  assert.match(errors.concept_note_path, /PDF/i);
});

test("normalizeConceptNoteTitle trims and collapses whitespace", () => {
  assert.equal(
    normalizeConceptNoteTitle("  Improving   Waste  Management  "),
    "Improving Waste Management"
  );
});

test("Stage 1 step 3 is Concept Note; step 4 is Review", () => {
  const app = readFileSync(
    resolve("app/(applicant)/applicant/application/page.js"),
    "utf8"
  );
  assert.match(app, /Concept Note/);
  assert.match(app, /stepLabels = \["Personal", "Academic", "Documents", "Concept Note", "Review"\]/);
  assert.match(app, /step === 3 &&[\s\S]*ConceptNote/);
  assert.match(app, /step === 4 && <ReviewSubmit/);
  assert.equal(existsSync(resolve("app/(applicant)/applicant/application/steps/ConceptNote.jsx")), true);
});

test("validateStep index 3 uses concept note validation", () => {
  const errors = validateStep(3, {});
  assert.ok(errors.concept_note_title);
  assert.ok(errors.concept_note_path);
});

test("validateForSubmit requires Concept Note", () => {
  const without = { ...baseValid };
  delete without.concept_note_title;
  delete without.concept_note_path;
  const errors = validateForSubmit(without);
  assert.ok(errors.concept_note_title);
  assert.ok(errors.concept_note_path);
  assert.deepEqual(validateForSubmit(baseValid), {});
});

test("concept note fields are allowlisted and privileged fields stay blocked", () => {
  const { data, ignoredDangerousFields } = sanitizeStage1ApplicationData({
    concept_note_title: "Improving Waste Management Among Households in Madina",
    concept_note_path: "user/concept-note/a.pdf",
    status: "accepted",
    director_notes: "secret",
  });
  assert.equal(data.concept_note_title, "Improving Waste Management Among Households in Madina");
  assert.equal(data.concept_note_path, "user/concept-note/a.pdf");
  assert.equal(data.status, undefined);
  assert.ok(ignoredDangerousFields.includes("status"));
});

test("server eligibility requires Concept Note for new submissions", () => {
  const without = { ...baseValid };
  delete without.concept_note_path;
  const bad = evaluateEligibilityForAutoReject(without);
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /Concept Note/i);
  assert.equal(evaluateEligibilityForAutoReject(baseValid).ok, true);
});

test("page-count is review-enforced (not programmatic) in this stack", () => {
  assert.equal(CONCEPT_NOTE_PAGE_COUNT_ENFORCED, false);
  const concept = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ConceptNote.jsx"),
    "utf8"
  );
  assert.match(concept, /CONCEPT_NOTE_ONE_PAGE_MESSAGE/);
  assert.match(concept, /concept-note/);
  assert.match(concept, /Multi-page files may be rejected during review/);
  assert.doesNotMatch(concept, /pdf-parse|pageCount|getPageCount/);
});

test("migration adds concept note columns", () => {
  const path = resolve("supabase/migrations/202608190001_stage1_concept_note.sql");
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /concept_note_title/);
  assert.match(sql, /concept_note_path/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS/);
});

test("Review, Director, Assessor, Stage 2 reference Concept Note", () => {
  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  assert.match(review, /Concept Note/);
  assert.match(review, /concept_note_title/);
  assert.match(review, /View Concept Note/);
  assert.match(review, /stepIndex=\{3\}/);

  const assessor = readFileSync(resolve("app/(dashboard)/assessor/[id]/page.js"), "utf8");
  assert.match(assessor, /Concept Note/);
  assert.match(assessor, /concept_note_path/);

  const director = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(director, /Concept Note/);
  assert.match(director, /concept_note_title/);

  const stage2 = readFileSync(resolve("app/(applicant)/applicant/stage2/page.js"), "utf8");
  assert.match(stage2, /Your Concept Note/);
  assert.match(stage2, /Use your Stage 1 Concept Note as the description/);
});

test("old applications without Concept Note still sanitize and load safely", () => {
  const { data } = sanitizeStage1ApplicationData({
    full_name: "Legacy Applicant",
    university: "University of Ghana",
  });
  assert.equal(data.full_name, "Legacy Applicant");
  assert.equal(data.concept_note_title, undefined);
  assert.equal(data.concept_note_path, undefined);
  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  assert.match(review, /Not provided/);
});
