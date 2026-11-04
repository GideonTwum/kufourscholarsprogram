import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_APPLICATIONS_CLEAR_ALL_HREF,
  describeActiveDirectorApplicationFilters,
  directorApplicationsEmptyMessage,
  directorStageStatusCompatible,
  directorStageWorkflowCompatible,
  findDirectorApplicationFilterConflicts,
  hasActiveDirectorApplicationFilters,
  mergeDirectorApplicationFilters,
} from "../lib/director-application-filters.js";
import {
  classifyDirectorApplications,
  filterByDirectorWorkflow,
} from "../lib/director-application-workflow.js";
import { filterByDirectorApplicationStage } from "../lib/director-application-scope.js";
import { DIRECTOR_PENDING_STATUSES } from "../lib/director-application-scope.js";

function app(id, status) {
  return { id, status, full_name: id, profiles: { email: `${id}@example.com` } };
}

test("Interview ∩ Rejected is an empty set while Interview count can still be 217-class", () => {
  const classified = classifyDirectorApplications(
    [
      app("i1", "called_for_interview"),
      app("i2", "interview_review_pending"),
      app("r1", "rejected"),
      app("a1", "accepted"),
    ],
    {}
  );
  const rejected = classified.filter(({ app: row }) => row.status === "rejected");
  const interviewRejected = filterByDirectorApplicationStage(rejected, "interview");
  assert.equal(interviewRejected.length, 0);

  const interview = filterByDirectorApplicationStage(classified, "interview");
  assert.equal(interview.length, 2);
  assert.equal(directorStageStatusCompatible("interview", "rejected"), false);
  assert.equal(directorStageStatusCompatible("interview", "pending"), true);
});

test("Interview ∩ Interview/Panel remains valid", () => {
  assert.equal(directorStageWorkflowCompatible("interview", "interview_panel"), true);
  const classified = classifyDirectorApplications(
    [app("i1", "called_for_interview"), app("s1", "stage_1_submitted")],
    {}
  );
  const interview = filterByDirectorApplicationStage(classified, "interview");
  const both = filterByDirectorWorkflow(interview, "interview_panel");
  assert.equal(both.length, 1);
});

test("Selecting Interview clears incompatible Rejected status", () => {
  const next = mergeDirectorApplicationFilters(
    { status: "rejected", workflow: "interview_panel", stage: "all" },
    { stage: "interview" }
  );
  assert.equal(next.stage, "interview");
  assert.equal(next.status, "");
  assert.equal(next.workflow, "interview_panel");
});

test("Selecting Rejected clears Interview stage and Interview/Panel workflow", () => {
  const next = mergeDirectorApplicationFilters(
    { stage: "interview", workflow: "interview_panel", status: "" },
    { status: "rejected" }
  );
  assert.equal(next.status, "rejected");
  assert.equal(next.stage, "all");
  assert.equal(next.workflow, "all");
});

test("Selecting Interview clears Unassigned workflow", () => {
  const next = mergeDirectorApplicationFilters(
    { stage: "all", workflow: "unassigned", status: "pending" },
    { stage: "interview" }
  );
  assert.equal(next.stage, "interview");
  assert.equal(next.workflow, "all");
  assert.equal(next.status, "pending");
});

test("Selecting Interview/Panel aligns Stage 1 away to Interview", () => {
  const next = mergeDirectorApplicationFilters(
    { stage: "stage_1", workflow: "all", status: "" },
    { workflow: "interview_panel" }
  );
  assert.equal(next.workflow, "interview_panel");
  assert.equal(next.stage, "interview");
});

test("Valid Stage 1 + Pending + Assessed is preserved", () => {
  const next = mergeDirectorApplicationFilters(
    { stage: "stage_1", workflow: "assessed", status: "pending" },
    { stage: "stage_1" }
  );
  assert.equal(next.stage, "stage_1");
  assert.equal(next.workflow, "assessed");
  assert.equal(next.status, "pending");
  assert.ok(DIRECTOR_PENDING_STATUSES.includes("stage_1_submitted"));
});

test("Active filter description and clear-all href", () => {
  assert.equal(DIRECTOR_APPLICATIONS_CLEAR_ALL_HREF, "/director/applications");
  assert.equal(hasActiveDirectorApplicationFilters({ stage: "interview", status: "rejected" }), true);
  assert.equal(hasActiveDirectorApplicationFilters({}), false);
  const described = describeActiveDirectorApplicationFilters({
    stage: "interview",
    workflow: "interview_panel",
    status: "rejected",
  });
  assert.ok(described.some((row) => row.key === "stage" && row.value === "Interview"));
  assert.ok(described.some((row) => row.key === "status" && row.value === "Rejected"));
});

test("Empty state explains Interview + Rejected conflict", () => {
  const message = directorApplicationsEmptyMessage({
    stage: "interview",
    workflow: "interview_panel",
    status: "rejected",
  });
  assert.match(message, /cannot combine/i);
  assert.match(message, /Rejected/i);
  assert.match(message, /Status-only|chip counts/i);
  assert.doesNotMatch(message, /^No Interview-stage applications in this view\.$/);

  const conflicts = findDirectorApplicationFilterConflicts({
    stage: "interview",
    status: "rejected",
  });
  assert.ok(conflicts.length >= 1);
});

test("Applications page clears incompatible filters and exposes Clear All", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/applications/page.js"), "utf8");
  assert.match(page, /mergeDirectorApplicationFilters/);
  assert.match(page, /Clear All Filters/);
  assert.match(page, /Active filters:/);
  assert.match(page, /hrefForFilterChange/);
  assert.doesNotMatch(page, /href=\{hrefForFilters\(\{ \.\.\.listFilters, stage: key \}\)\}/);

  const list = readFileSync(resolve("components/director/DirectorApplicationsList.jsx"), "utf8");
  assert.match(list, /directorApplicationsEmptyMessage/);
  assert.match(list, /Clear All Filters/);
  assert.match(list, /cannot match any applications when combined/i);
});
