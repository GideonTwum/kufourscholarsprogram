import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ASSESSOR_ASSIGNABLE_STATUSES,
  isAssessorAssignableStatus,
  isUuid,
  normalizeAssignmentApplicationIds,
  resolveReassignAssessorId,
} from "../lib/assessor-assignment.js";

test("assignable statuses include stage 1 and stage 2 review states", () => {
  assert.ok(isAssessorAssignableStatus("stage_1_submitted"));
  assert.ok(isAssessorAssignableStatus("stage_1_approved"));
  assert.ok(isAssessorAssignableStatus("stage_2_submitted"));
  assert.equal(isAssessorAssignableStatus("draft"), false);
  assert.equal(isAssessorAssignableStatus("accepted"), false);
  assert.equal(isAssessorAssignableStatus("rejected"), false);
  assert.ok(ASSESSOR_ASSIGNABLE_STATUSES.includes("review_pending"));
});

test("normalizes application_id and application_ids", () => {
  assert.deepEqual(
    normalizeAssignmentApplicationIds({
      application_id: "a",
      application_ids: ["b", "a", "c"],
    }),
    ["a", "b", "c"]
  );
  assert.deepEqual(normalizeAssignmentApplicationIds({ application_id: "x" }), ["x"]);
});

test("resolves reassign assessor id from new_assessor_id or assessor_id", () => {
  assert.equal(resolveReassignAssessorId({ new_assessor_id: "n1" }), "n1");
  assert.equal(resolveReassignAssessorId({ assessor_id: "a1" }), "a1");
  assert.equal(resolveReassignAssessorId({}), null);
});

test("uuid helper validates shape", () => {
  assert.equal(isUuid("73cfbb7d-4696-41fc-b157-2f3bf02ad804"), true);
  assert.equal(isUuid("not-a-uuid"), false);
});

test("GET /api/director/assessors attaches count fields", () => {
  const src = readFileSync(
    resolve("app/api/director/assessors/route.js"),
    "utf8"
  );
  assert.match(src, /active_assignment_count/);
  assert.match(src, /assignment_count/);
  assert.match(src, /assessment_count/);
  assert.match(src, /ASSESSOR_ASSIGNABLE_STATUSES/);
});

test("assignment API accepts application_id and REASSIGN_REQUIRED", () => {
  const src = readFileSync(
    resolve("app/api/director/assessor-assignments/route.js"),
    "utf8"
  );
  assert.match(src, /normalizeAssignmentApplicationIds/);
  assert.match(src, /REASSIGN_REQUIRED/);
  assert.match(src, /INACTIVE_ASSESSOR/);
  assert.match(src, /force_reassign/);
  assert.match(src, /application_status_unchanged/);
  assert.match(src, /assessor\.assignment_created/);
  assert.match(src, /new_assessor_id/);
  assert.doesNotMatch(src, /\.from\(["']applications["']\)\s*\.update/);
});

test("application detail exposes assignment panel and API payload", () => {
  assert.ok(existsSync(resolve("components/director/DirectorAssessorAssignmentPanel.jsx")));
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(page, /DirectorAssessorAssignmentPanel/);
  const api = readFileSync(
    resolve("app/api/director/applications/[id]/route.js"),
    "utf8"
  );
  assert.match(api, /active_assessors/);
  assert.match(api, /assignable/);
  assert.match(api, /latest_assessment/);
});

test("verify SQL and one-active index docs exist", () => {
  assert.ok(existsSync(resolve("docs/VERIFY-ASSESSOR-ASSIGNMENT-FLOW.sql")));
  const mig = readFileSync(
    resolve("supabase/migrations/202608040001_assessor_account_lifecycle_and_governance.sql"),
    "utf8"
  );
  assert.match(mig, /assessor_assignments_one_active_per_application/);
});

test("bulk assessors page sends force_reassign", () => {
  const src = readFileSync(
    resolve("app/(dashboard)/director/assessors/page.js"),
    "utf8"
  );
  assert.match(src, /force_reassign:\s*true/);
});
