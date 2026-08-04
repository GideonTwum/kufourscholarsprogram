import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assessmentStageForStatus,
  nextStatusForAssessorRecommendation,
  suggestedDirectorStatusForRecommendation,
  validateAssessmentPayload,
  pickAssessorSafeApplication,
  assertAssessorResponseSafe,
  ASSESSOR_FORBIDDEN_RESPONSE_KEYS,
  normalizeAssessorRecommendation,
} from "../lib/assessor-workflow.js";
import {
  assessorDeletionBlockReason,
  isProfileActive,
  deactivateProfilePayload,
  reactivateProfilePayload,
} from "../lib/staff-lifecycle.js";

test("maps application statuses to assessor stages", () => {
  assert.equal(assessmentStageForStatus("stage_1_submitted"), "stage_1");
  assert.equal(assessmentStageForStatus("stage_2_submitted"), "stage_2");
});

test("assessor recommendations suggest director statuses but do not auto-accept", () => {
  assert.equal(
    suggestedDirectorStatusForRecommendation("stage_1", "recommend_progress"),
    "stage_1_approved"
  );
  assert.equal(
    nextStatusForAssessorRecommendation("stage_2", "recommend_interview"),
    "interview_review_pending"
  );
  assert.notEqual(suggestedDirectorStatusForRecommendation("stage_1", "recommend_progress"), "accepted");
  assert.equal(suggestedDirectorStatusForRecommendation("stage_1", "recommend_reject"), "rejected");
});

test("validateAssessmentPayload stores recommendation and does not set nextStatus to mutate", () => {
  const result = validateAssessmentPayload(
    {
      academic_score: 5,
      leadership_score: 4,
      service_score: 4,
      communication_score: 3,
      recommendation: "advance",
      notes: "Strong applicant",
    },
    "stage_1_submitted"
  );

  assert.equal(result.error, undefined);
  assert.equal(result.stage, "stage_1");
  assert.equal(result.nextStatus, null);
  assert.equal(result.assessment.recommendation, "recommend_progress");
  assert.equal(result.suggestedStatus, "stage_1_approved");
  assert.equal(result.assessment.overall_score, 4);
});

test("legacy reject recommendation normalizes but is advisory only", () => {
  const result = validateAssessmentPayload(
    {
      academic_score: 2,
      leadership_score: 2,
      service_score: 2,
      communication_score: 2,
      recommendation: "reject",
    },
    "stage_1_submitted"
  );
  assert.equal(result.error, undefined);
  assert.equal(result.assessment.recommendation, "recommend_reject");
  assert.equal(result.nextStatus, null);
  assert.equal(normalizeAssessorRecommendation("reject"), "recommend_reject");
});

test("rejects invalid assessor score values", () => {
  const result = validateAssessmentPayload(
    {
      academic_score: 6,
      leadership_score: 4,
      service_score: 4,
      communication_score: 3,
      recommendation: "recommend_progress",
    },
    "stage_1_submitted"
  );
  assert.match(result.error, /scores/);
});

test("pickAssessorSafeApplication strips director_notes and rejection fields", () => {
  const safe = pickAssessorSafeApplication({
    id: "1",
    full_name: "Ada",
    status: "stage_1_submitted",
    director_notes: "secret",
    rejection_reason: "no",
    university: "UG",
    profiles: { full_name: "Ada", email: "a@ex.com", role: "applicant" },
  });
  assert.equal(safe.full_name, "Ada");
  assert.equal(safe.university, "UG");
  assert.equal(safe.director_notes, undefined);
  assert.equal(safe.rejection_reason, undefined);
  assert.equal(safe.profiles.email, "a@ex.com");
  assert.equal(safe.profiles.role, undefined);
  assert.equal(assertAssessorResponseSafe(safe), null);
  assert.ok(ASSESSOR_FORBIDDEN_RESPONSE_KEYS.includes("director_notes"));
});

test("assessorDeletionBlockReason blocks history", () => {
  assert.match(
    assessorDeletionBlockReason({ assessmentCount: 1, assignmentCount: 0 }),
    /Deactivate/
  );
  assert.match(
    assessorDeletionBlockReason({ assessmentCount: 0, assignmentCount: 2 }),
    /Deactivate/
  );
  assert.equal(assessorDeletionBlockReason({ assessmentCount: 0, assignmentCount: 0 }), null);
});

test("lifecycle payloads for assessors", () => {
  assert.equal(isProfileActive({ is_active: false }), false);
  const off = deactivateProfilePayload("dir-1");
  assert.equal(off.is_active, false);
  assert.equal(reactivateProfilePayload().is_active, true);
});

test("assessor APIs require active assessor and do not mutate status", () => {
  const list = readFileSync(resolve("app/api/assessor/applications/route.js"), "utf8");
  const detail = readFileSync(resolve("app/api/assessor/applications/[id]/route.js"), "utf8");
  assert.match(list, /requireActiveAssessor/);
  assert.match(detail, /requireActiveAssessor/);
  assert.match(detail, /status_unchanged/);
  assert.doesNotMatch(detail, /\.update\(updatePayload\)/);
  assert.match(detail, /ASSESSOR_APPLICATION_SELECT|pickAssessorSafeApplication/);
});

test("director assessor lifecycle and assignment gates exist", () => {
  assert.equal(existsSync(resolve("app/api/director/assessors/[id]/route.js")), true);
  const life = readFileSync(resolve("app/api/director/assessors/[id]/route.js"), "utf8");
  assert.match(life, /deactivate|reactivate/);
  assert.match(life, /assessorDeletionBlockReason|assignment or assessment history/);
  assert.match(life, /deleteUser/);

  const assign = readFileSync(resolve("app/api/director/assessor-assignments/route.js"), "utf8");
  assert.match(assign, /isProfileActive|inactive assessor/);
  assert.match(assign, /unassign|reassign/);
  assert.match(assign, /one active|reassigned/i);

  const invite = readFileSync(resolve("app/api/assessor/invite/route.js"), "utf8");
  assert.match(invite, /410/);
});

test("migration and director UI cover lifecycle", () => {
  assert.equal(
    existsSync(resolve("supabase/migrations/202608040001_assessor_account_lifecycle_and_governance.sql")),
    true
  );
  const sql = readFileSync(
    resolve("supabase/migrations/202608040001_assessor_account_lifecycle_and_governance.sql"),
    "utf8"
  );
  assert.match(sql, /assessor_assignments_one_active_per_application/);
  assert.match(sql, /ON DELETE SET NULL/);
  assert.match(sql, /is_active_assessor/);

  const ui = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  assert.match(ui, /Deactivate/);
  assert.match(ui, /Permanently Delete/);
  assert.doesNotMatch(ui, /SERVICE_ROLE|createAdminClient/);
});

test("assessor applications alias redirects to canonical detail route", () => {
  const alias = readFileSync(
    resolve("app/(dashboard)/assessor/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(alias, /redirect/);
  assert.match(alias, /\/assessor\/\$\{id\}|\/assessor\//);
});
