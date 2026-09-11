import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getWassceResultsPaths,
  hasWassceResults,
  shouldShowWassceHistoricalNote,
  validateDocuments,
  MIN_WASSCE_RESULTS,
  MAX_WASSCE_RESULTS,
  WASSCE_HISTORICAL_MESSAGE,
} from "../lib/application-validation.js";
import { STAGE1_ALLOWED_FIELDS } from "../lib/stage1-application-payload.js";
import { evaluateEligibilityForAutoReject } from "../lib/eligibility-server.js";

function baseDocs(overrides = {}) {
  return {
    cv_personal_statement_url: "user/cv/a.pdf",
    academic_transcript_url: "user/transcript/a.pdf",
    wassce_results_urls: ["user/wassce-results/a.pdf"],
    recommendation_urls: ["user/recommendation/1.pdf", "user/recommendation/2.pdf"],
    photo_url: "https://example.com/photo.jpg",
    student_id_path: "user/student-id/id.pdf",
    ksp_tiktok_follow_screenshot_path: "user/social/tiktok.webp",
    ksp_linkedin_follow_screenshot_path: "user/social/linkedin.png",
    ksp_instagram_follow_screenshot_path: "user/social/instagram.jpg",
    ...overrides,
  };
}

test("migration adds nullable wassce_results_urls jsonb", () => {
  const path = resolve("supabase/migrations/202609110001_wassce_results_urls.sql");
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /wassce_results_urls/);
  assert.match(sql, /jsonb/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS/i);
  assert.doesNotMatch(sql, /NOT NULL/);
  assert.doesNotMatch(sql, /UPDATE public\.applications/i);
});

test("getWassceResultsPaths reads array and ignores blanks", () => {
  assert.deepEqual(getWassceResultsPaths({ wassce_results_urls: ["a.pdf", "", "b.pdf"] }), [
    "a.pdf",
    "b.pdf",
  ]);
  assert.deepEqual(getWassceResultsPaths({ wassce_results_urls: [] }), []);
  assert.deepEqual(getWassceResultsPaths({}), []);
  assert.equal(hasWassceResults({ wassce_results_urls: ["a.pdf"] }), true);
  assert.equal(hasWassceResults({ wassce_results_urls: [] }), false);
});

test("historical note for staff when WASSCE missing on non-editable apps", () => {
  assert.equal(shouldShowWassceHistoricalNote({}, { isEditable: false }), true);
  assert.equal(shouldShowWassceHistoricalNote({ wassce_results_urls: [] }, { isEditable: false }), true);
  assert.equal(
    shouldShowWassceHistoricalNote({ wassce_results_urls: ["a.pdf"] }, { isEditable: false }),
    false
  );
  assert.equal(shouldShowWassceHistoricalNote({}, { isEditable: true }), false);
  assert.match(WASSCE_HISTORICAL_MESSAGE, /Not collected when this application was submitted/);
});

test("validateDocuments requires transcript and at least one WASSCE document", () => {
  assert.equal(MIN_WASSCE_RESULTS, 1);
  assert.equal(MAX_WASSCE_RESULTS, 5);

  const ok = validateDocuments(baseDocs());
  assert.equal(ok.academic_transcript_url, undefined);
  assert.equal(ok.wassce_results_urls, undefined);

  const noTranscript = validateDocuments(baseDocs({ academic_transcript_url: "" }));
  assert.match(noTranscript.academic_transcript_url, /required/i);

  const noWassce = validateDocuments(baseDocs({ wassce_results_urls: [] }));
  assert.match(noWassce.wassce_results_urls, /at least one/i);

  const multi = validateDocuments(
    baseDocs({ wassce_results_urls: ["a.pdf", "b.pdf", "c.pdf"] })
  );
  assert.equal(multi.wassce_results_urls, undefined);

  const tooMany = validateDocuments(
    baseDocs({
      wassce_results_urls: ["1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf", "6.pdf"],
    })
  );
  assert.match(tooMany.wassce_results_urls, /at most/i);
});

test("eligibility auto-reject requires WASSCE for new submissions", () => {
  const missing = evaluateEligibilityForAutoReject({
    date_of_birth: "2005-01-15",
    country_of_origin: "Ghana",
    nationality: "Ghanaian",
    year_of_study: "First Year",
    junior_high_school: "JHS",
    senior_high_school: "SHS",
    confirms_ghana_enrollment: true,
    cv_personal_statement_url: "cv.pdf",
    academic_transcript_url: "t.pdf",
    wassce_results_urls: [],
    recommendation_urls: ["r1.pdf", "r2.pdf"],
    photo_url: "https://example.com/p.jpg",
    student_id_path: "id.pdf",
    ksp_tiktok_follow_screenshot_path: "tt.png",
    ksp_linkedin_follow_screenshot_path: "li.png",
    ksp_instagram_follow_screenshot_path: "ig.png",
    linkedin_url: "https://www.linkedin.com/in/test",
    concept_note_title: "A solid concept note title",
    concept_note_path: "note.pdf",
  });
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /WASSCE/i);
});

test("payload allowlist and UI/staff wiring include wassce_results_urls", () => {
  assert.ok(STAGE1_ALLOWED_FIELDS.includes("wassce_results_urls"));

  const docs = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  assert.match(docs, /WASSCE \/ NovDec Results/);
  assert.match(docs, /wassce-results/);
  assert.match(docs, /wassce_add/);

  const review = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ReviewSubmit.jsx"),
    "utf8"
  );
  assert.match(review, /WASSCE \/ NovDec Results/);
  assert.match(review, /shouldShowWassceHistoricalNote/);

  const director = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(director, /getWassceResultsPaths/);
  assert.match(director, /WASSCE_HISTORICAL_MESSAGE/);

  const assessor = readFileSync(resolve("app/(dashboard)/assessor/[id]/page.js"), "utf8");
  assert.match(assessor, /getWassceResultsPaths/);

  const panel = readFileSync(resolve("app/(dashboard)/panel/[id]/page.js"), "utf8");
  assert.match(panel, /getWassceResultsPaths/);

  const submit = readFileSync(resolve("app/api/applications/submit-stage1/route.js"), "utf8");
  assert.match(submit, /getWassceResultsPaths/);
  assert.doesNotMatch(submit, /\.update\(.*wassce.*historical/i);

  const workflow = readFileSync(resolve("lib/assessor-workflow.js"), "utf8");
  assert.match(workflow, /wassce_results_urls/);
});

test("validateForSubmit rejects missing WASSCE while preserving other rules", () => {
  // Minimal incomplete docs fixture — expect wassce error among others
  const errors = validateDocuments({
    cv_personal_statement_url: "cv.pdf",
    academic_transcript_url: "t.pdf",
    wassce_results_urls: [],
    recommendation_urls: ["a.pdf", "b.pdf"],
    photo_url: "https://x.com/p.jpg",
    student_id_path: "id.pdf",
    ksp_tiktok_follow_screenshot_path: "t.png",
    ksp_linkedin_follow_screenshot_path: "l.png",
    ksp_instagram_follow_screenshot_path: "i.png",
  });
  assert.match(errors.wassce_results_urls, /at least one/i);
  assert.equal(errors.academic_transcript_url, undefined);
});
