import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DIRECTOR_PENDING_STATUSES,
  applyDirectorStatusFilter,
  isDirectorOperationalStatus,
  summarizeDirectorApplicationCounts,
} from "../lib/director-application-scope.js";
import { VALID_APPLICATION_STATUSES } from "../lib/application-status-transition.mjs";

test("summarizeDirectorApplicationCounts excludes drafts from All and matches pills", () => {
  const rows = [
    { status: "draft" },
    { status: "draft" },
    { status: "draft" },
    { status: "stage_2_submitted" },
    { status: "interview_review_pending" },
  ];
  const s = summarizeDirectorApplicationCounts(rows);
  assert.equal(s.total_including_drafts, 5);
  assert.equal(s.draft, 3);
  assert.equal(s.all, 2);
  assert.equal(s.pending, 2);
  assert.equal(s.accepted, 0);
  assert.equal(s.rejected, 0);
  assert.equal(s.all, s.pending + s.accepted + s.rejected);
});

test("every non-draft workflow status is operational and pending when not terminal", () => {
  for (const status of VALID_APPLICATION_STATUSES) {
    if (status === "draft") {
      assert.equal(isDirectorOperationalStatus(status), false);
      continue;
    }
    assert.equal(isDirectorOperationalStatus(status), true);
    if (status === "accepted" || status === "rejected") {
      assert.equal(DIRECTOR_PENDING_STATUSES.includes(status), false);
    } else {
      assert.ok(
        DIRECTOR_PENDING_STATUSES.includes(status) || status === "pending",
        `${status} should be pending`
      );
    }
  }
});

test("null application_class_name does not affect operational count helper", () => {
  const s = summarizeDirectorApplicationCounts([
    { status: "stage_1_submitted", application_class_name: null },
    { status: "draft", application_class_name: "11th Class" },
    { status: "accepted", application_class_name: "10th Class" },
  ]);
  assert.equal(s.all, 2);
  assert.equal(s.pending, 1);
  assert.equal(s.accepted, 1);
  assert.equal(s.draft, 1);
});

test("applyDirectorStatusFilter pending and exact statuses", () => {
  const calls = [];
  const query = {
    in(col, vals) {
      calls.push(["in", col, vals]);
      return query;
    },
    eq(col, val) {
      calls.push(["eq", col, val]);
      return query;
    },
  };
  applyDirectorStatusFilter(query, "pending");
  assert.deepEqual(calls[0], ["in", "status", DIRECTOR_PENDING_STATUSES]);
  calls.length = 0;
  applyDirectorStatusFilter(query, "stage_1_submitted");
  assert.deepEqual(calls[0], ["eq", "status", "stage_1_submitted"]);
  calls.length = 0;
  applyDirectorStatusFilter(query, "accepted");
  assert.deepEqual(calls[0], ["eq", "status", "accepted"]);
  calls.length = 0;
  const untouched = applyDirectorStatusFilter(query, "draft");
  assert.equal(untouched, query);
  assert.equal(calls.length, 0);
});

test("dashboard metrics and applications page share operational scope helper", () => {
  const metrics = readFileSync(resolve("app/api/director/dashboard-metrics/route.js"), "utf8");
  const apps = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  const dash = readFileSync(resolve("app/(dashboard)/director/page.js"), "utf8");
  assert.match(metrics, /summarizeDirectorApplicationCounts/);
  assert.match(metrics, /total_applications: summary\.all/);
  assert.match(metrics, /draft_applications: summary\.draft/);
  assert.match(apps, /applyDirectorOperationalScope/);
  assert.match(apps, /summarizeDirectorApplicationCounts/);
  assert.match(apps, /DIRECTOR_PRIMARY_FILTERS/);
  assert.match(dash, /Submitted applications/);
  assert.match(dash, /draft_applications/);
});

test("changing Current Application Class setting does not rewrite historical apps in scope helper", () => {
  // Scope helper never reads site_settings — Class changes cannot relabel counts here
  const src = readFileSync(resolve("lib/director-application-scope.js"), "utf8");
  assert.doesNotMatch(src, /site_settings|from\(["']site_settings["']\)/);
  assert.match(src, /NOT limited by application_class_name/);
});
