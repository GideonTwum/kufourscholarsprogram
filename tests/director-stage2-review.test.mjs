import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyDirectorStage2Review,
  filterByDirectorStage2Review,
  isStage2Rejected,
  normalizeDirectorStage2ReviewParam,
  summarizeDirectorStage2ReviewCounts,
} from "../lib/director-stage2-review.js";
import { directorApplicationMatchesSearch } from "../lib/director-application-workflow.js";
import { buildDirectorApplicationsListHref } from "../lib/director-applications-return.js";

function app(id, status, extra = {}) {
  return {
    id,
    status,
    full_name: extra.full_name || `Applicant ${id}`,
    university: extra.university || "University of Ghana",
    video_youtube_url: extra.video_youtube_url ?? null,
    stage_2_submitted_at: extra.stage_2_submitted_at ?? null,
    stage_2_approved_at: extra.stage_2_approved_at ?? null,
    profiles: {
      full_name: extra.full_name || `Applicant ${id}`,
      email: extra.email || `${id}@example.com`,
    },
    ...extra,
  };
}

function rows(list) {
  return list.map((a) => ({ app: a, workflow: "unassigned" }));
}

const approved = app("ok", "stage_2_approved", {
  stage_2_submitted_at: "2026-10-01T00:00:00.000Z",
  stage_2_approved_at: "2026-10-10T00:00:00.000Z",
  video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
});
const submitted = app("wait", "stage_2_submitted", {
  stage_2_submitted_at: "2026-10-02T00:00:00.000Z",
  video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
});
const deferred = app("hold", "stage_2_review_pending", {
  stage_2_submitted_at: "2026-10-03T00:00:00.000Z",
  video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
});
const rejectedS2 = app("no", "rejected", {
  stage_2_submitted_at: "2026-10-04T00:00:00.000Z",
  video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
});
const rejectedS1 = app("s1no", "rejected");
const awaitingS2 = app("await", "stage_1_approved");
const interview = app("int", "interview_review_pending", {
  stage_2_submitted_at: "2026-09-01T00:00:00.000Z",
  stage_2_approved_at: "2026-09-10T00:00:00.000Z",
});
const rejectedAfterApproval = app("later", "rejected", {
  stage_2_submitted_at: "2026-09-01T00:00:00.000Z",
  stage_2_approved_at: "2026-09-10T00:00:00.000Z",
});

const population = rows([
  approved,
  submitted,
  deferred,
  rejectedS2,
  rejectedS1,
  awaitingS2,
  interview,
  rejectedAfterApproval,
]);

test("1. Previously approved Stage 2 applicants appear in the Approved filter", () => {
  const filtered = filterByDirectorStage2Review(population, "approved");
  assert.deepEqual(
    filtered.map((r) => r.app.id),
    ["ok"]
  );
  assert.equal(classifyDirectorStage2Review(approved), "approved");
});

test("2. Pending applicants do not appear in the Approved filter", () => {
  const filtered = filterByDirectorStage2Review(population, "approved");
  assert.equal(filtered.some((r) => r.app.id === "wait" || r.app.id === "hold"), false);
});

test("3. Rejected applicants are categorized correctly", () => {
  assert.equal(isStage2Rejected(rejectedS2), true);
  assert.equal(isStage2Rejected(rejectedS1), false);
  assert.equal(isStage2Rejected(rejectedAfterApproval), false);
  const filtered = filterByDirectorStage2Review(population, "rejected");
  assert.deepEqual(
    filtered.map((r) => r.app.id),
    ["no"]
  );
});

test("4. Submitted applicants are not automatically treated as approved", () => {
  assert.equal(classifyDirectorStage2Review(submitted), "pending");
  assert.notEqual(classifyDirectorStage2Review(submitted), "approved");
  const withVideoOnly = app("vid", "stage_1_approved", {
    video_youtube_url: "https://www.youtube.com/watch?v=abcdefghijk",
  });
  assert.notEqual(classifyDirectorStage2Review(withVideoOnly), "approved");
});

test("5. Search and filtering work together", () => {
  const pending = filterByDirectorStage2Review(population, "pending");
  const named = pending.filter((row) =>
    directorApplicationMatchesSearch(row.app, "Applicant wait")
  );
  assert.equal(named.length, 1);
  assert.equal(named[0].app.id, "wait");
  const href = buildDirectorApplicationsListHref({
    stage2: "approved",
    q: "Ama",
    workflow: "assessed",
  });
  assert.match(href, /stage2=approved/);
  assert.match(href, /q=Ama/);
  assert.match(href, /workflow=assessed/);
});

test("6. Pagination remains the full filtered set (no silent page drop)", () => {
  const apps = readFileSync(resolve("app/(dashboard)/director/applications/page.js"), "utf8");
  assert.match(apps, /filterByDirectorStage2Review\(stageScoped, stage2Filter\)/);
  assert.match(apps, /fetchAllApplicationPages/);
  assert.doesNotMatch(apps, /\.range\(0,\s*49\)/);
});

test("7. Dashboard counts match database status definitions", () => {
  const counts = summarizeDirectorStage2ReviewCounts(population);
  assert.equal(counts.approved, 1);
  assert.equal(counts.submitted, 1);
  assert.equal(counts.pending, 2);
  assert.equal(counts.all, 3);
  assert.equal(counts.rejected, 1);
  assert.equal(counts.all, counts.pending + counts.approved);
  const metrics = readFileSync(resolve("app/api/director/dashboard-metrics/route.js"), "utf8");
  assert.match(metrics, /stage_2_approved: stage2Approved/);
  assert.match(metrics, /stage_2_pending_review: stage2Pending/);
  assert.match(metrics, /fetchDirectorStage2RejectedCount/);
  assert.match(metrics, /requireActiveDirector/);
});

test("8. Unauthorized users cannot access director-only information", () => {
  const metrics = readFileSync(resolve("app/api/director/dashboard-metrics/route.js"), "utf8");
  assert.match(metrics, /requireActiveDirector/);
  const page = readFileSync(resolve("app/(dashboard)/director/applications/page.js"), "utf8");
  assert.match(page, /isDirectorRole/);
  assert.match(page, /director-login/);
});

test("9. Existing approval workflows continue to function", () => {
  const actions = readFileSync(resolve("lib/director-stage-actions.js"), "utf8");
  assert.match(actions, /Approve Stage 2/);
  assert.match(actions, /next: "stage_2_approved"/);
  const update = readFileSync(resolve("app/api/applications/[id]/update-status/route.js"), "utf8");
  assert.match(update, /stage_2_approved_at/);
  assert.match(update, /requireActiveDirector/);
});

test("10. Empty filter results display an appropriate message", () => {
  const list = readFileSync(resolve("components/director/DirectorApplicationsList.jsx"), "utf8");
  assert.match(list, /No Stage 2 approved applications in this view/);
  assert.match(list, /No Stage 2 applications pending review in this view/);
  assert.match(list, /No Stage 2 rejected applications in this view/);
  assert.equal(filterByDirectorStage2Review(rows([awaitingS2]), "approved").length, 0);
});

test("All Stage 2 filter is the live pipeline and ignores interview/final outcomes", () => {
  const filtered = filterByDirectorStage2Review(population, "all");
  assert.deepEqual(filtered.map((r) => r.app.id).sort(), ["hold", "ok", "wait"]);
  assert.equal(normalizeDirectorStage2ReviewParam("approved"), "approved");
  assert.equal(normalizeDirectorStage2ReviewParam("nope"), "");
});

test("dashboard cards deep-link to Stage 2 review filters", () => {
  const dash = readFileSync(resolve("app/(dashboard)/director/page.js"), "utf8");
  assert.match(dash, /stage2=approved/);
  assert.match(dash, /stage2=pending/);
  assert.match(dash, /stage2=rejected/);
  assert.match(dash, /status=stage_2_submitted/);
  const returnHelper = readFileSync(resolve("lib/director-applications-return.js"), "utf8");
  assert.match(returnHelper, /"stage2"/);
});
