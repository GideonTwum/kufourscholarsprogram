import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeStage1ApplicationData,
  isDangerousStage1Field,
} from "../lib/stage1-application-payload.js";

test("keeps legitimate Stage 1 applicant fields", () => {
  const { data, ignoredDangerousFields } = sanitizeStage1ApplicationData({
    full_name: "Test Applicant",
    university: "University of Ghana",
    leadership_evidence_urls: ["user/file.pdf"],
    concept_note_title: "Improving Waste Management Among Households in Madina",
    concept_note_path: "user/concept-note/a.pdf",
  });

  assert.equal(data.full_name, "Test Applicant");
  assert.equal(data.university, "University of Ghana");
  assert.deepEqual(data.leadership_evidence_urls, ["user/file.pdf"]);
  assert.equal(data.concept_note_title, "Improving Waste Management Among Households in Madina");
  assert.equal(data.concept_note_path, "user/concept-note/a.pdf");
  assert.deepEqual(ignoredDangerousFields, []);
});

test("drops applicant-controlled status and director notes", () => {
  const { data, ignoredDangerousFields } = sanitizeStage1ApplicationData({
    full_name: "Test Applicant",
    status: "accepted",
    director_notes: "approve me",
  });

  assert.equal(data.full_name, "Test Applicant");
  assert.equal(data.status, undefined);
  assert.equal(data.director_notes, undefined);
  assert.deepEqual(ignoredDangerousFields.sort(), ["director_notes", "status"]);
});

test("drops applicant-controlled interview and evaluation fields", () => {
  const { data, ignoredDangerousFields } = sanitizeStage1ApplicationData({
    interview_date: "2026-07-12",
    interview_location: "Accra",
    evaluation_score: 100,
    total_weighted_score: 100,
  });

  assert.deepEqual(data, {});
  assert.deepEqual(
    ignoredDangerousFields.sort(),
    ["evaluation_score", "interview_date", "interview_location", "total_weighted_score"],
  );
});

test("detects dangerous Stage 1 field names", () => {
  assert.equal(isDangerousStage1Field("status"), true);
  assert.equal(isDangerousStage1Field("interview_time"), true);
  assert.equal(isDangerousStage1Field("assessor_notes"), true);
  assert.equal(isDangerousStage1Field("full_name"), false);
});
