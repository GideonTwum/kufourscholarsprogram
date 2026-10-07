import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_APPLICATION_STAGE_1_STATUSES,
  DIRECTOR_APPLICATION_STAGE_2_STATUSES,
  DIRECTOR_APPLICATION_STAGE_INTERVIEW_STATUSES,
  DIRECTOR_APPLICATION_STAGE_FILTERS,
  DIRECTOR_PENDING_STATUSES,
  classifyDirectorApplicationStage,
  filterByDirectorApplicationStage,
  normalizeDirectorApplicationStageParam,
  summarizeDirectorApplicationStageCounts,
} from "../lib/director-application-scope.js";
import {
  DIRECTOR_INTERVIEW_PANEL_STATUSES,
  classifyDirectorApplications,
  classifyDirectorWorkflowStage,
  directorApplicationMatchesSearch,
  filterByDirectorWorkflow,
  buildDirectorAssignmentWorkflowMap,
} from "../lib/director-application-workflow.js";

const ASSESSOR_A = "assessor-a";

function app(id, status, extra = {}) {
  return {
    id,
    status,
    full_name: extra.full_name || `Applicant ${id}`,
    university: extra.university || "University of Ghana",
    profiles: {
      full_name: extra.full_name || `Applicant ${id}`,
      email: extra.email || `${id}@example.com`,
    },
    ...extra,
  };
}

test("canonical Stage 1 statuses include awaiting Stage 2 (stage_1_approved)", () => {
  assert.deepEqual(
    [...DIRECTOR_APPLICATION_STAGE_1_STATUSES].sort(),
    ["pending", "review_pending", "stage_1_approved", "stage_1_submitted"].sort()
  );
  for (const status of [
    "stage_1_submitted",
    "pending",
    "review_pending",
    "stage_1_approved",
  ]) {
    assert.equal(classifyDirectorApplicationStage(status), "stage_1");
  }
});

test("canonical Stage 2 statuses stop before interview", () => {
  assert.deepEqual(
    [...DIRECTOR_APPLICATION_STAGE_2_STATUSES].sort(),
    ["stage_2_approved", "stage_2_review_pending", "stage_2_submitted"].sort()
  );
  for (const status of DIRECTOR_APPLICATION_STAGE_2_STATUSES) {
    assert.equal(classifyDirectorApplicationStage(status), "stage_2");
  }
  assert.notEqual(classifyDirectorApplicationStage("stage_1_approved"), "stage_2");
});

test("Interview stage matches workflow interview/panel statuses", () => {
  assert.deepEqual(
    [...DIRECTOR_APPLICATION_STAGE_INTERVIEW_STATUSES].sort(),
    [...DIRECTOR_INTERVIEW_PANEL_STATUSES].sort()
  );
  for (const status of DIRECTOR_APPLICATION_STAGE_INTERVIEW_STATUSES) {
    assert.equal(classifyDirectorApplicationStage(status), "interview");
  }
});

test("draft excluded from Application Stage chips", () => {
  assert.equal(classifyDirectorApplicationStage("draft"), null);
  assert.equal(classifyDirectorApplicationStage(null), null);
  const counts = summarizeDirectorApplicationStageCounts([
    app("d1", "draft"),
    app("s1", "stage_1_submitted"),
  ]);
  assert.equal(counts.all, 1);
  assert.equal(counts.stage_1, 1);
});

test("accepted/rejected remain Status-only (not Stage 1/2/Interview)", () => {
  assert.equal(classifyDirectorApplicationStage("accepted"), null);
  assert.equal(classifyDirectorApplicationStage("rejected"), null);
  const counts = summarizeDirectorApplicationStageCounts([
    app("a1", "accepted"),
    app("r1", "rejected"),
    app("s1", "stage_1_submitted"),
  ]);
  assert.equal(counts.all, 3);
  assert.equal(counts.stage_1, 1);
  assert.equal(counts.stage_2, 0);
  assert.equal(counts.interview, 0);
});

test("Stage + Workflow composition: Stage 1 Unassigned / Assigned / Assessed", () => {
  const apps = [
    app("u1", "stage_1_submitted"),
    app("a1", "stage_1_approved"),
    app("e1", "review_pending"),
    app("s2", "stage_2_submitted"),
  ];
  const map = buildDirectorAssignmentWorkflowMap(
    [
      {
        application_id: "a1",
        assessor_id: ASSESSOR_A,
        status: "active",
        profiles: { full_name: "A" },
      },
      {
        application_id: "e1",
        assessor_id: ASSESSOR_A,
        status: "active",
        profiles: { full_name: "A" },
      },
    ],
    [
      {
        application_id: "e1",
        assessor_id: ASSESSOR_A,
        stage: "stage_1",
        recommendation: "advance",
      },
    ],
    Object.fromEntries(apps.map((a) => [a.id, a.status]))
  );
  const classified = classifyDirectorApplications(apps, map);
  const stage1 = filterByDirectorApplicationStage(classified, "stage_1");
  assert.equal(stage1.length, 3);
  assert.deepEqual(
    filterByDirectorWorkflow(stage1, "unassigned").map((r) => r.app.id),
    ["u1"]
  );
  assert.deepEqual(
    filterByDirectorWorkflow(stage1, "assigned").map((r) => r.app.id),
    ["a1"]
  );
  assert.deepEqual(
    filterByDirectorWorkflow(stage1, "assessed").map((r) => r.app.id),
    ["e1"]
  );
});

test("Stage + Workflow composition: Stage 2 Unassigned / Assigned / Assessed", () => {
  const apps = [
    app("u2", "stage_2_submitted"),
    app("a2", "stage_2_review_pending"),
    app("e2", "stage_2_approved"),
    app("s1", "stage_1_submitted"),
  ];
  const map = buildDirectorAssignmentWorkflowMap(
    [
      {
        application_id: "a2",
        assessor_id: ASSESSOR_A,
        status: "active",
        profiles: { full_name: "A" },
      },
      {
        application_id: "e2",
        assessor_id: ASSESSOR_A,
        status: "active",
        profiles: { full_name: "A" },
      },
    ],
    [
      {
        application_id: "e2",
        assessor_id: ASSESSOR_A,
        stage: "stage_2",
        recommendation: "advance",
      },
    ],
    Object.fromEntries(apps.map((a) => [a.id, a.status]))
  );
  const classified = classifyDirectorApplications(apps, map);
  const stage2 = filterByDirectorApplicationStage(classified, "stage_2");
  assert.equal(stage2.length, 3);
  assert.deepEqual(
    filterByDirectorWorkflow(stage2, "unassigned").map((r) => r.app.id),
    ["u2"]
  );
  assert.deepEqual(
    filterByDirectorWorkflow(stage2, "assigned").map((r) => r.app.id),
    ["a2"]
  );
  assert.deepEqual(
    filterByDirectorWorkflow(stage2, "assessed").map((r) => r.app.id),
    ["e2"]
  );
});

test("Interview stage filter", () => {
  const classified = classifyDirectorApplications(
    [
      app("i1", "interview_review_pending"),
      app("i2", "called_for_interview"),
      app("i3", "interview"),
      app("s2", "stage_2_approved"),
    ],
    {}
  );
  const interview = filterByDirectorApplicationStage(classified, "interview");
  assert.equal(interview.length, 3);
  assert.ok(interview.every((r) => r.workflow === "interview_panel"));
});

test("stage + status composition (Pending excludes terminals)", () => {
  const classified = classifyDirectorApplications(
    [
      app("s1", "stage_1_submitted"),
      app("acc", "accepted"),
      app("s2", "stage_2_submitted"),
    ],
    {}
  );
  const pending = classified.filter(({ app: a }) =>
    DIRECTOR_PENDING_STATUSES.includes(a.status)
  );
  const stage1Pending = filterByDirectorApplicationStage(pending, "stage_1");
  assert.deepEqual(
    stage1Pending.map((r) => r.app.id),
    ["s1"]
  );
  const acceptedOnly = classified.filter(({ app: a }) => a.status === "accepted");
  assert.equal(filterByDirectorApplicationStage(acceptedOnly, "stage_1").length, 0);
  assert.equal(filterByDirectorApplicationStage(acceptedOnly, "all").length, 1);
});

test("stage + search composition", () => {
  const classified = classifyDirectorApplications(
    [
      app("ug", "stage_2_submitted", {
        full_name: "Ama Mensah",
        university: "University of Ghana",
      }),
      app("kn", "stage_2_submitted", {
        full_name: "Kojo Boateng",
        university: "KNUST",
      }),
      app("s1", "stage_1_submitted", {
        full_name: "Ama Other",
        university: "University of Ghana",
      }),
    ],
    {}
  );
  const stage2 = filterByDirectorApplicationStage(classified, "stage_2");
  const assessed = filterByDirectorWorkflow(stage2, "all");
  const searched = assessed.filter((row) =>
    directorApplicationMatchesSearch(row.app, "University of Ghana")
  );
  assert.deepEqual(
    searched.map((r) => r.app.id),
    ["ug"]
  );
});

test("stage counts use full operational population (not search-narrowed)", () => {
  const classified = classifyDirectorApplications(
    [
      app("s1", "stage_1_submitted"),
      app("s2", "stage_2_submitted"),
      app("i1", "called_for_interview"),
      app("acc", "accepted"),
      app("d1", "draft"),
    ].filter((a) => a.status !== "draft"),
    {}
  );
  const counts = summarizeDirectorApplicationStageCounts(classified);
  assert.equal(counts.all, 4);
  assert.equal(counts.stage_1, 1);
  assert.equal(counts.stage_2, 1);
  assert.equal(counts.interview, 1);
});

test("invalid stage query falls back to all", () => {
  assert.equal(normalizeDirectorApplicationStageParam("nope"), "all");
  assert.equal(normalizeDirectorApplicationStageParam(""), "all");
  assert.equal(normalizeDirectorApplicationStageParam("stage_1"), "stage_1");
  assert.equal(normalizeDirectorApplicationStageParam("STAGE_2"), "all");
});

test("existing workflow filters unchanged by stage helpers", () => {
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: false,
    }),
    "unassigned"
  );
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_2_submitted",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    "assessed"
  );
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "called_for_interview",
      hasActiveAssignment: true,
    }),
    "interview_panel"
  );
});

test("Director Applications page wires stage URL and filter composition", () => {
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.match(page, /buildDirectorApplicationsListHref/);
  assert.match(page, /normalizeDirectorApplicationStageParam/);
  const returnHelper = readFileSync(resolve("lib/director-applications-return.js"), "utf8");
  assert.match(returnHelper, /params\.set\("stage"/);
  assert.match(page, /filterByDirectorApplicationStage/);
  assert.match(page, /summarizeDirectorApplicationStageCounts/);
  assert.match(page, /Application Stage/);
  assert.match(page, /Assessment Workflow/);
  assert.match(page, /DIRECTOR_APPLICATION_STAGE_FILTERS/);
  // Composition order: status then stage then workflow
  const statusIdx = page.indexOf("statusScoped");
  const stageIdx = page.indexOf("stageScoped");
  const listIdx = page.indexOf("filterByDirectorWorkflow(stageScoped");
  assert.ok(statusIdx > 0 && stageIdx > statusIdx && listIdx > stageIdx);
});

test("stage helpers are read-only classification (no DB mutation helpers)", () => {
  const scope = readFileSync(resolve("lib/director-application-scope.js"), "utf8");
  const stageBlock = scope.slice(
    scope.indexOf("Application Stage"),
    scope.indexOf("Exact status counts via PostgREST")
  );
  assert.doesNotMatch(stageBlock, /\.update\(|\.insert\(|\.delete\(|\.upsert\(/);
  assert.ok(DIRECTOR_APPLICATION_STAGE_FILTERS.some((f) => f.key === "stage_1"));
});
