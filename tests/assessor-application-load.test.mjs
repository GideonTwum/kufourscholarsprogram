import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ASSESSOR_APPLICATION_SELECT } from "../lib/assessor-workflow.js";

test("assessor application select omits non-existent created_at", () => {
  assert.equal(ASSESSOR_APPLICATION_SELECT.includes("created_at"), false);
  assert.equal(ASSESSOR_APPLICATION_SELECT.includes("stage2_submitted_at"), false);
  assert.match(ASSESSOR_APPLICATION_SELECT, /updated_at/);
  assert.match(ASSESSOR_APPLICATION_SELECT, /submitted_at/);
});

test("assessor applications API returns empty array without treating as error", () => {
  const src = readFileSync(resolve("app/api/assessor/applications/route.js"), "utf8");
  assert.match(src, /applications:\s*\[\]/);
  assert.match(src, /requireActiveAssessor/);
  assert.match(src, /assessor_id.*assessorId|eq\("assessor_id"/);
  assert.match(src, /status", "active"|eq\("status", "active"\)/);
  assert.match(src, /Applications could not be loaded/);
  assert.match(src, /debug/);
  assert.doesNotMatch(src, /created_at/);
});

test("assessor dashboard distinguishes empty vs failure and retries", () => {
  const src = readFileSync(resolve("app/(dashboard)/assessor/page.js"), "utf8");
  assert.match(src, /No applications have been assigned to you yet/);
  assert.match(src, /Retry/);
  assert.match(src, /Assigned to you/);
  assert.match(src, /Assessment pending|Assessment submitted/);
});

test("director detail assignment includes assessor identity and assessment summary", () => {
  const src = readFileSync(resolve("app/api/director/applications/[id]/route.js"), "utf8");
  assert.match(src, /assessment:\s*assessmentSummary|assessment: assessmentSummary/);
  assert.match(src, /full_name/);
  assert.match(src, /email/);
  const panel = readFileSync(
    resolve("components/director/DirectorAssessorAssignmentPanel.jsx"),
    "utf8"
  );
  assert.match(panel, /Assigned to:/);
});

test("director applications list shows Unassigned or Assigned to", () => {
  const src = readFileSync(resolve("app/(dashboard)/director/applications/page.js"), "utf8");
  assert.match(src, /loadActiveAssignmentLabels/);
  assert.match(src, /Unassigned/);
  assert.match(src, /Assigned to/);
});

test("verify assessor application load SQL exists", () => {
  assert.ok(existsSync(resolve("docs/VERIFY-ASSESSOR-APPLICATION-LOAD.sql")));
});
