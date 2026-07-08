import test from "node:test";
import assert from "node:assert/strict";

import {
  assessmentStageForStatus,
  nextStatusForAssessorRecommendation,
  validateAssessmentPayload,
} from "../lib/assessor-workflow.js";

test("maps application statuses to assessor stages", () => {
  assert.equal(assessmentStageForStatus("stage_1_submitted"), "stage_1");
  assert.equal(assessmentStageForStatus("stage_2_submitted"), "stage_2");
});

test("maps assessor recommendations to controlled next statuses", () => {
  assert.equal(nextStatusForAssessorRecommendation("stage_1", "advance"), "stage_1_approved");
  assert.equal(nextStatusForAssessorRecommendation("stage_2", "recommend_interview"), "interview_review_pending");
  assert.equal(nextStatusForAssessorRecommendation("stage_2", "advance"), null);
});

test("validates complete assessor scoring payload", () => {
  const result = validateAssessmentPayload(
    {
      academic_score: 5,
      leadership_score: 4,
      service_score: 4,
      communication_score: 3,
      recommendation: "advance",
      notes: "Strong applicant",
    },
    "stage_1_submitted",
  );

  assert.equal(result.error, undefined);
  assert.equal(result.stage, "stage_1");
  assert.equal(result.nextStatus, "stage_1_approved");
  assert.equal(result.assessment.overall_score, 4);
});

test("rejects invalid assessor score values", () => {
  const result = validateAssessmentPayload(
    {
      academic_score: 6,
      leadership_score: 4,
      service_score: 4,
      communication_score: 3,
      recommendation: "advance",
    },
    "stage_1_submitted",
  );

  assert.match(result.error, /scores/);
});
