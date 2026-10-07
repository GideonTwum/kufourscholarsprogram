import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  filterByDirectorApplicationStage,
} from "../lib/director-application-scope.js";
import {
  buildDirectorAssignmentWorkflowMap,
  classifyDirectorApplications,
  directorApplicationMatchesSearch,
  filterByDirectorAssessor,
  filterByDirectorWorkflow,
  normalizeDirectorAssessorParam,
  summarizeDirectorAssessorOptions,
  summarizeSelectedAssessorWorkload,
} from "../lib/director-application-workflow.js";

const ASSESSOR_A = "11111111-1111-4111-8111-111111111111";
const ASSESSOR_B = "22222222-2222-4222-8222-222222222222";
const ASSESSOR_INACTIVE = "33333333-3333-4333-8333-333333333333";

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

function active(applicationId, assessorId, name, isActive = true) {
  return {
    application_id: applicationId,
    assessor_id: assessorId,
    status: "active",
    profiles: { full_name: name, email: `${name}@example.com`, is_active: isActive },
  };
}

function classifyWith(apps, assignments, assessments = [], statusByAppId) {
  const statusMap =
    statusByAppId ||
    Object.fromEntries(apps.map((a) => [a.id, a.status]));
  const map = buildDirectorAssignmentWorkflowMap(assignments, assessments, statusMap);
  return classifyDirectorApplications(apps, map);
}

test("All Assessors shows full operational population", () => {
  const apps = [
    app("u1", "stage_1_submitted"),
    app("a1", "stage_1_submitted"),
    app("b1", "stage_2_submitted"),
  ];
  const classified = classifyWith(apps, [
    active("a1", ASSESSOR_A, "Ada"),
    active("b1", ASSESSOR_B, "Ben"),
  ]);
  const all = filterByDirectorAssessor(classified, "");
  assert.equal(all.length, 3);
  assert.deepEqual(
    all.map((r) => r.app.id).sort(),
    ["a1", "b1", "u1"]
  );
});

test("Selecting Assessor A shows only Assessor A's active assignments", () => {
  const apps = [
    app("a1", "stage_1_submitted"),
    app("a2", "stage_2_submitted"),
    app("b1", "stage_1_submitted"),
    app("u1", "stage_1_submitted"),
  ];
  const classified = classifyWith(apps, [
    active("a1", ASSESSOR_A, "Ada"),
    active("a2", ASSESSOR_A, "Ada"),
    active("b1", ASSESSOR_B, "Ben"),
  ]);
  const onlyA = filterByDirectorAssessor(classified, ASSESSOR_A);
  assert.deepEqual(
    onlyA.map((r) => r.app.id).sort(),
    ["a1", "a2"]
  );
});

test("Assessor A filter does not include Assessor B assignments", () => {
  const classified = classifyWith(
    [app("a1", "stage_1_submitted"), app("b1", "stage_1_submitted")],
    [active("a1", ASSESSOR_A, "Ada"), active("b1", ASSESSOR_B, "Ben")]
  );
  const onlyA = filterByDirectorAssessor(classified, ASSESSOR_A);
  assert.equal(onlyA.length, 1);
  assert.equal(onlyA[0].app.id, "a1");
  assert.notEqual(onlyA[0].assignment.assessor_id, ASSESSOR_B);
});

test("Historical reassigned rows do not count as current", () => {
  const apps = [app("x1", "stage_1_submitted")];
  // Only active rows are passed into the map (page query filters status=active).
  // Defensive: reassigned rows in the array must be ignored.
  const classified = classifyWith(apps, [
    {
      application_id: "x1",
      assessor_id: ASSESSOR_A,
      status: "reassigned",
      profiles: { full_name: "Ada", is_active: true },
    },
    active("x1", ASSESSOR_B, "Ben"),
  ]);
  assert.equal(filterByDirectorAssessor(classified, ASSESSOR_A).length, 0);
  assert.equal(filterByDirectorAssessor(classified, ASSESSOR_B).length, 1);
  const options = summarizeDirectorAssessorOptions(classified);
  assert.equal(options.find((o) => o.id === ASSESSOR_A), undefined);
  assert.equal(options.find((o) => o.id === ASSESSOR_B)?.count, 1);
});

test("Completed assignment rows do not count as current", () => {
  const apps = [app("x1", "stage_1_submitted")];
  const classified = classifyWith(apps, [
    {
      application_id: "x1",
      assessor_id: ASSESSOR_A,
      status: "completed",
      profiles: { full_name: "Ada", is_active: true },
    },
  ]);
  assert.equal(filterByDirectorAssessor(classified, ASSESSOR_A).length, 0);
  assert.equal(summarizeDirectorAssessorOptions(classified).length, 0);
});

test("Inactive assessor with active assignments remains discoverable", () => {
  const apps = [
    app("i1", "stage_1_submitted"),
    app("i2", "review_pending"),
    app("a1", "stage_1_submitted"),
  ];
  const classified = classifyWith(apps, [
    active("i1", ASSESSOR_INACTIVE, "Ivy", false),
    active("i2", ASSESSOR_INACTIVE, "Ivy", false),
    active("a1", ASSESSOR_A, "Ada", true),
  ]);
  const options = summarizeDirectorAssessorOptions(classified);
  const ivy = options.find((o) => o.id === ASSESSOR_INACTIVE);
  assert.ok(ivy);
  assert.equal(ivy.isActive, false);
  assert.equal(ivy.count, 2);
  assert.equal(ivy.name, "Ivy");
  assert.equal(filterByDirectorAssessor(classified, ASSESSOR_INACTIVE).length, 2);
});

test("Stage 1 + Assessor composition", () => {
  const apps = [
    app("s1", "stage_1_submitted"),
    app("s1b", "stage_1_approved"),
    app("s2", "stage_2_submitted"),
  ];
  const classified = classifyWith(apps, [
    active("s1", ASSESSOR_A, "Ada"),
    active("s1b", ASSESSOR_A, "Ada"),
    active("s2", ASSESSOR_A, "Ada"),
  ]);
  const stage1 = filterByDirectorApplicationStage(classified, "stage_1");
  const adaStage1 = filterByDirectorAssessor(stage1, ASSESSOR_A);
  assert.deepEqual(
    adaStage1.map((r) => r.app.id).sort(),
    ["s1", "s1b"]
  );
});

test("Stage 2 + Assessor composition", () => {
  const apps = [
    app("s1", "stage_1_submitted"),
    app("s2", "stage_2_submitted"),
    app("s2b", "stage_2_review_pending"),
  ];
  const classified = classifyWith(apps, [
    active("s1", ASSESSOR_A, "Ada"),
    active("s2", ASSESSOR_A, "Ada"),
    active("s2b", ASSESSOR_B, "Ben"),
  ]);
  const stage2 = filterByDirectorApplicationStage(classified, "stage_2");
  const adaStage2 = filterByDirectorAssessor(stage2, ASSESSOR_A);
  assert.deepEqual(
    adaStage2.map((r) => r.app.id),
    ["s2"]
  );
});

test("Assessed + Assessor composition uses current-stage semantics", () => {
  const apps = [
    app("done", "stage_1_submitted"),
    app("pending", "stage_1_submitted"),
    app("wrongStage", "stage_2_submitted"),
  ];
  const assignments = [
    active("done", ASSESSOR_A, "Ada"),
    active("pending", ASSESSOR_A, "Ada"),
    active("wrongStage", ASSESSOR_A, "Ada"),
  ];
  const assessments = [
    {
      application_id: "done",
      assessor_id: ASSESSOR_A,
      stage: "stage_1",
      recommendation: "advance",
    },
    // Stage-1 assessment must NOT count for a Stage-2 application
    {
      application_id: "wrongStage",
      assessor_id: ASSESSOR_A,
      stage: "stage_1",
      recommendation: "advance",
    },
  ];
  const classified = classifyWith(apps, assignments, assessments);
  const assessed = filterByDirectorWorkflow(classified, "assessed");
  const adaAssessed = filterByDirectorAssessor(assessed, ASSESSOR_A);
  assert.deepEqual(
    adaAssessed.map((r) => r.app.id),
    ["done"]
  );
  assert.equal(adaAssessed[0].workflow, "assessed");
});

test("Assigned + Assessor composition", () => {
  const apps = [
    app("awaiting", "stage_1_submitted"),
    app("done", "stage_1_submitted"),
  ];
  const classified = classifyWith(
    apps,
    [active("awaiting", ASSESSOR_A, "Ada"), active("done", ASSESSOR_A, "Ada")],
    [
      {
        application_id: "done",
        assessor_id: ASSESSOR_A,
        stage: "stage_1",
      },
    ]
  );
  const assigned = filterByDirectorWorkflow(classified, "assigned");
  const adaAssigned = filterByDirectorAssessor(assigned, ASSESSOR_A);
  assert.deepEqual(
    adaAssigned.map((r) => r.app.id),
    ["awaiting"]
  );
});

test("Unassigned + Assessor = empty (filters compose, not ignored)", () => {
  const apps = [
    app("u1", "stage_1_submitted"),
    app("a1", "stage_1_submitted"),
  ];
  const classified = classifyWith(apps, [active("a1", ASSESSOR_A, "Ada")]);
  const unassigned = filterByDirectorWorkflow(classified, "unassigned");
  const combo = filterByDirectorAssessor(unassigned, ASSESSOR_A);
  assert.equal(combo.length, 0);
});

test("Status + Assessor composition", () => {
  const apps = [
    app("p1", "stage_1_submitted"),
    app("acc", "accepted"),
    app("rej", "rejected"),
  ];
  // Terminals may still have leftover active assignments — Assessor filter is active-only.
  const classified = classifyWith(apps, [
    active("p1", ASSESSOR_A, "Ada"),
    active("acc", ASSESSOR_A, "Ada"),
  ]);
  const pending = classified.filter(({ app: a }) => a.status === "stage_1_submitted");
  assert.equal(filterByDirectorAssessor(pending, ASSESSOR_A).length, 1);
  const accepted = classified.filter(({ app: a }) => a.status === "accepted");
  assert.equal(filterByDirectorAssessor(accepted, ASSESSOR_A).length, 1);
});

test("Search + Assessor composition", () => {
  const apps = [
    app("ug", "stage_1_submitted", {
      full_name: "Ama Mensah",
      university: "University of Ghana",
    }),
    app("kn", "stage_1_submitted", {
      full_name: "Kojo Boateng",
      university: "KNUST",
    }),
    app("other", "stage_1_submitted", {
      full_name: "Ama Other",
      university: "University of Ghana",
    }),
  ];
  const classified = classifyWith(apps, [
    active("ug", ASSESSOR_A, "Ada"),
    active("kn", ASSESSOR_A, "Ada"),
    active("other", ASSESSOR_B, "Ben"),
  ]);
  const ada = filterByDirectorAssessor(classified, ASSESSOR_A);
  const searched = ada.filter((row) =>
    directorApplicationMatchesSearch(row.app, "University of Ghana")
  );
  assert.deepEqual(
    searched.map((r) => r.app.id),
    ["ug"]
  );
});

test("Assessor counts use full operational population", () => {
  const apps = [
    app("a1", "stage_1_submitted"),
    app("a2", "stage_2_submitted"),
    app("b1", "stage_1_submitted"),
  ];
  const classified = classifyWith(apps, [
    active("a1", ASSESSOR_A, "Ada"),
    active("a2", ASSESSOR_A, "Ada"),
    active("b1", ASSESSOR_B, "Ben"),
  ]);
  // Even after narrowing the list for UI, option counts come from full classified set.
  const stage1 = filterByDirectorApplicationStage(classified, "stage_1");
  assert.equal(stage1.length, 2);
  const options = summarizeDirectorAssessorOptions(classified);
  assert.equal(options.find((o) => o.id === ASSESSOR_A)?.count, 2);
  assert.equal(options.find((o) => o.id === ASSESSOR_B)?.count, 1);
});

test("Assessed/Awaiting summary uses existing current-stage semantics", () => {
  const apps = [
    app("done", "stage_1_submitted"),
    app("awaiting", "stage_1_submitted"),
    app("interview", "called_for_interview"),
  ];
  const classified = classifyWith(
    apps,
    [
      active("done", ASSESSOR_A, "Ada"),
      active("awaiting", ASSESSOR_A, "Ada"),
      active("interview", ASSESSOR_A, "Ada"),
    ],
    [
      {
        application_id: "done",
        assessor_id: ASSESSOR_A,
        stage: "stage_1",
      },
    ]
  );
  const summary = summarizeSelectedAssessorWorkload(classified, ASSESSOR_A);
  assert.equal(summary.name, "Ada");
  assert.equal(summary.total, 3);
  assert.equal(summary.assessed, 1);
  assert.equal(summary.awaiting, 1);
  // interview_panel counted in total only (not assessed/awaiting)
});

test("Invalid assessor query falls back to All Assessors", () => {
  assert.equal(normalizeDirectorAssessorParam(""), "");
  assert.equal(normalizeDirectorAssessorParam("not-a-uuid"), "");
  assert.equal(normalizeDirectorAssessorParam("11111111-1111-4111-8111-111111111111"), ASSESSOR_A);
  assert.equal(
    normalizeDirectorAssessorParam("11111111-1111-4111-8111-111111111111".toUpperCase()),
    ASSESSOR_A
  );
});

test("Drafts excluded from assessor options and filter population", () => {
  const operational = [
    app("a1", "stage_1_submitted"),
  ].filter((a) => a.status !== "draft");
  const classified = classifyWith(operational, [active("a1", ASSESSOR_A, "Ada")]);
  assert.ok(!classified.some((r) => r.app.status === "draft"));
  assert.equal(summarizeDirectorAssessorOptions(classified)[0].count, 1);
});

test("Existing Stage/Workflow/Status filters unchanged by assessor helpers", () => {
  const apps = [
    app("u1", "stage_1_submitted"),
    app("a1", "stage_1_submitted"),
    app("e1", "stage_1_submitted"),
  ];
  const classified = classifyWith(
    apps,
    [active("a1", ASSESSOR_A, "Ada"), active("e1", ASSESSOR_A, "Ada")],
    [{ application_id: "e1", assessor_id: ASSESSOR_A, stage: "stage_1" }]
  );
  assert.equal(filterByDirectorWorkflow(classified, "unassigned").length, 1);
  assert.equal(filterByDirectorWorkflow(classified, "assigned").length, 1);
  assert.equal(filterByDirectorWorkflow(classified, "assessed").length, 1);
  assert.equal(filterByDirectorApplicationStage(classified, "stage_1").length, 3);
});

test("Assessor helpers are read-only (no DB mutation)", () => {
  const wf = readFileSync(resolve("lib/director-application-workflow.js"), "utf8");
  const blockStart = wf.indexOf("normalizeDirectorAssessorParam");
  const block = wf.slice(blockStart);
  assert.doesNotMatch(block, /\.update\(|\.insert\(|\.delete\(|\.upsert\(/);
});

test("Director Applications page wires assessor URL and filter composition", () => {
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.match(page, /buildDirectorApplicationsListHref/);
  assert.match(page, /normalizeDirectorAssessorParam/);
  assert.match(page, /assessorFilter/);
  const returnHelper = readFileSync(resolve("lib/director-applications-return.js"), "utf8");
  assert.match(returnHelper, /params\.set\("assessor"/);
  assert.match(page, /filterByDirectorAssessor/);
  assert.match(page, /summarizeDirectorAssessorOptions/);
  assert.match(page, /summarizeSelectedAssessorWorkload/);
  assert.match(page, /DirectorAssessorFilter/);
  assert.match(page, /loadDirectorAssignmentWorkflowMeta/);
  assert.match(page, /isDirectorRole/);
  const meta = readFileSync(resolve("lib/director-assignment-workflow-meta.js"), "utf8");
  assert.match(meta, /is_active/);
  // Composition: status → stage → workflow → assessor
  const statusIdx = page.indexOf("statusScoped");
  const stageIdx = page.indexOf("stageScoped");
  const workflowIdx = page.indexOf("workflowScoped");
  const assessorIdx = page.indexOf("filterByDirectorAssessor(workflowScoped");
  assert.ok(statusIdx > 0 && stageIdx > statusIdx);
  assert.ok(workflowIdx > stageIdx && assessorIdx > workflowIdx);
});

test("Assessor filter UI does not expose UUIDs as labels", () => {
  const filterUi = readFileSync(
    resolve("components/director/DirectorAssessorFilter.jsx"),
    "utf8"
  );
  assert.match(filterUi, /All Assessors/);
  assert.match(filterUi, /Inactive/);
  assert.match(filterUi, /optionLabel/);
  // Visible option text uses name + count, not raw id interpolation in children.
  assert.match(filterUi, /\{optionLabel\(o\)\}/);
  assert.doesNotMatch(filterUi, /<option[^>]*>\{[^}]*\.id/);
});
