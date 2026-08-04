import test from "node:test";
import assert from "node:assert/strict";

import {
  validateStatusUpdateInput,
  assertStatusTransition,
  canTransitionStatus,
  safeAuthRedirectPath,
  normalizeApplicationStatus,
} from "../lib/application-status-transition.mjs";
import { isDirectorRole, dashboardPathForRole } from "../lib/roles.js";
import { sanitizeStoragePath, isOwnerStoragePath } from "../lib/storage-path.js";
import { nextStatusForAssessorRecommendation } from "../lib/assessor-workflow.js";

test("rejects an unknown status", () => {
  assert.equal(validateStatusUpdateInput({ status: "unknown" }), "Invalid status");
});

test("requires a class before accepting an applicant", () => {
  assert.equal(
    validateStatusUpdateInput({ status: "accepted", class_name: "  " }),
    "class_name is required when accepting an applicant"
  );
});

test("accepts a valid acceptance request", () => {
  assert.equal(
    validateStatusUpdateInput({ status: "accepted", class_name: "Class of 2026" }),
    null
  );
});

test("requires complete interview details", () => {
  assert.match(
    validateStatusUpdateInput({
      status: "called_for_interview",
      interview: { interview_date: "2026-07-01", interview_time: "", interview_location: "Accra" },
    }),
    /Interview date/
  );
});

test("accepts complete interview details", () => {
  assert.equal(
    validateStatusUpdateInput({
      status: "called_for_interview",
      interview: {
        interview_date: "2026-07-01",
        interview_time: "09:00 GMT",
        interview_location: "Accra",
      },
    }),
    null
  );
});

test("allows valid Stage 1 transitions", () => {
  assert.equal(assertStatusTransition("stage_1_submitted", "stage_1_approved"), null);
  assert.equal(assertStatusTransition("stage_1_submitted", "review_pending"), null);
  assert.equal(assertStatusTransition("stage_1_approved", "stage_2_submitted"), null);
});

test("blocks skipping stages and duplicate terminal updates", () => {
  assert.match(assertStatusTransition("stage_1_submitted", "accepted"), /Invalid status transition/);
  assert.match(assertStatusTransition("draft", "called_for_interview"), /Invalid status transition/);
  assert.match(assertStatusTransition("accepted", "rejected"), /Cannot change status after/);
  assert.match(assertStatusTransition("rejected", "stage_1_approved"), /Cannot change status after/);
  assert.equal(canTransitionStatus("accepted", "rejected"), false);
});

test("normalizes legacy statuses before transition checks", () => {
  assert.equal(normalizeApplicationStatus("pending"), "stage_1_submitted");
  assert.equal(assertStatusTransition("pending", "stage_1_approved"), null);
});

test("safeAuthRedirectPath blocks open redirects", () => {
  assert.equal(safeAuthRedirectPath("/applicant"), "/applicant");
  assert.equal(safeAuthRedirectPath("/applicant/stage2"), "/applicant/stage2");
  assert.equal(safeAuthRedirectPath("https://evil.com"), "/applicant");
  assert.equal(safeAuthRedirectPath("//evil.com"), "/applicant");
  assert.equal(safeAuthRedirectPath("javascript:alert(1)"), "/applicant");
  assert.equal(safeAuthRedirectPath("\\evil"), "/applicant");
  assert.equal(safeAuthRedirectPath(null), "/applicant");
});

test("canonical launch role is director only", () => {
  assert.equal(isDirectorRole("director"), true);
  assert.equal(isDirectorRole("administrator"), false);
  assert.equal(isDirectorRole("super_administrator"), false);
  assert.equal(isDirectorRole("applicant"), false);
  assert.equal(dashboardPathForRole("director"), "/director");
  assert.equal(dashboardPathForRole("assessor"), "/assessor");
  assert.equal(dashboardPathForRole("panel"), "/panel");
  assert.equal(dashboardPathForRole("applicant"), "/applicant");
});

test("storage path sanitization rejects traversal", () => {
  assert.equal(sanitizeStoragePath("user-abc1/file.pdf").ok, true);
  assert.equal(sanitizeStoragePath("../secret").ok, false);
  assert.equal(sanitizeStoragePath("user-abc1/../other/file.pdf").ok, false);
  assert.equal(sanitizeStoragePath("/absolute/path").ok, false);
  assert.equal(sanitizeStoragePath("//host/path").ok, false);
  assert.equal(sanitizeStoragePath("C:\\windows").ok, false);
  assert.equal(isOwnerStoragePath("abc12345/file.pdf", "abc12345"), true);
  assert.equal(isOwnerStoragePath("abc12345/file.pdf", "xyz"), false);
});

test("assessor cannot map to accepted final status", () => {
  assert.notEqual(nextStatusForAssessorRecommendation("stage_1", "recommend_progress"), "accepted");
  assert.notEqual(nextStatusForAssessorRecommendation("stage_2", "recommend_interview"), "accepted");
  // Suggested status for Director only — assessor APIs do not apply it
  assert.equal(nextStatusForAssessorRecommendation("stage_1", "recommend_reject"), "rejected");
});

test("panel has no status transition helper that accepts applicants", () => {
  // Panel scoring is client interview_evaluations only; ensure transition map
  // does not allow panel-like jumps from stage_1 to accepted.
  assert.equal(canTransitionStatus("stage_1_submitted", "accepted"), false);
  assert.equal(canTransitionStatus("interview", "accepted"), true);
});
