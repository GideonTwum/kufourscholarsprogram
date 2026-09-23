import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_INTERVIEW_PANEL_STATUSES,
  DIRECTOR_TERMINAL_STATUSES,
  DIRECTOR_WORKFLOW_FILTERS,
  classifyDirectorWorkflowStage,
  hasCompletedAssessorAssessmentForCurrentStage,
  buildDirectorAssignmentWorkflowMap,
  classifyDirectorApplications,
  filterByDirectorWorkflow,
  summarizeDirectorWorkflowCounts,
  directorApplicationMatchesSearch,
  isDirectorInterviewPanelStatus,
  isDirectorTerminalStatus,
} from "../lib/director-application-workflow.js";
import { DIRECTOR_PENDING_STATUSES } from "../lib/director-application-scope.js";
import { STATUS_TRANSITIONS } from "../lib/application-status-transition.mjs";

const ASSESSOR_A = "assessor-a";
const ASSESSOR_B = "assessor-b";

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

test("All Submitted includes submitted and excludes drafts", () => {
  const apps = [
    app("d1", "draft"),
    app("s1", "stage_1_submitted"),
    app("a1", "accepted"),
  ];
  const classified = classifyDirectorApplications(apps.filter((a) => a.status !== "draft"), {});
  const counts = summarizeDirectorWorkflowCounts(classified);
  assert.equal(counts.all, 2);
  assert.equal(classified.find((r) => r.app.id === "s1")?.workflow, "unassigned");
  // Accepted remains in All Submitted but is not an actionable queue
  assert.equal(classified.find((r) => r.app.id === "a1")?.workflow, null);
  assert.equal(classifyDirectorWorkflowStage({ status: "draft" }), null);
});

test("Unassigned: no active assignment included; active assignment excluded", () => {
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: false,
      hasCompletedAssessmentForAssignee: false,
    }),
    "unassigned"
  );
  assert.notEqual(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: false,
    }),
    "unassigned"
  );
});

test("Assigned: active assignment + incomplete assessment included; completed excluded", () => {
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: false,
    }),
    "assigned"
  );
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    "assessed"
  );
});

test("inactive/historical assignment does not count as Assigned", () => {
  const map = buildDirectorAssignmentWorkflowMap(
    [
      {
        application_id: "app-1",
        assessor_id: ASSESSOR_A,
        status: "completed",
        profiles: { full_name: "Old Assessor" },
      },
      {
        application_id: "app-2",
        assessor_id: ASSESSOR_A,
        status: "reassigned",
        profiles: { full_name: "Old Assessor" },
      },
    ],
    [],
    { "app-1": "stage_1_submitted", "app-2": "stage_1_submitted" }
  );
  assert.equal(map["app-1"], undefined);
  assert.equal(map["app-2"], undefined);
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: false,
      hasCompletedAssessmentForAssignee: false,
    }),
    "unassigned"
  );
});

test("Assessed: completed assessor workflow included; merely assigned excluded; unassigned excluded", () => {
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "review_pending",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    "assessed"
  );
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "review_pending",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: false,
    }),
    "assigned"
  );
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "review_pending",
      hasActiveAssignment: false,
      hasCompletedAssessmentForAssignee: true,
    }),
    "unassigned"
  );
});

test("assessment completion is stage-aware for the active assignee", () => {
  const assignment = { assessor_id: ASSESSOR_A };
  const assessments = [
    {
      application_id: "app-1",
      assessor_id: ASSESSOR_A,
      stage: "stage_1",
    },
    {
      application_id: "app-2",
      assessor_id: ASSESSOR_A,
      stage: "stage_1",
    },
  ];
  assert.equal(
    hasCompletedAssessorAssessmentForCurrentStage(
      "stage_1_submitted",
      assignment,
      assessments,
      "app-1"
    ),
    true
  );
  // Stage 2 application still needs a stage_2 assessment
  assert.equal(
    hasCompletedAssessorAssessmentForCurrentStage(
      "stage_2_submitted",
      assignment,
      assessments,
      "app-2"
    ),
    false
  );
  // Other assessor's assessment does not count
  assert.equal(
    hasCompletedAssessorAssessmentForCurrentStage(
      "stage_1_submitted",
      { assessor_id: ASSESSOR_B },
      assessments,
      "app-1"
    ),
    false
  );
});

test("Interview/Panel uses existing interview statuses only", () => {
  assert.deepEqual(DIRECTOR_INTERVIEW_PANEL_STATUSES, [
    "interview_review_pending",
    "called_for_interview",
    "interview",
  ]);
  for (const status of DIRECTOR_INTERVIEW_PANEL_STATUSES) {
    assert.equal(isDirectorInterviewPanelStatus(status), true);
    assert.equal(
      classifyDirectorWorkflowStage({
        status,
        hasActiveAssignment: true,
        hasCompletedAssessmentForAssignee: true,
      }),
      "interview_panel"
    );
  }
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_2_approved",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    "assessed"
  );
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: false,
      hasCompletedAssessmentForAssignee: false,
    }),
    "unassigned"
  );
});

test("workflow queues are mutually exclusive under priority rules", () => {
  // Interview wins over assessed/assigned
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "called_for_interview",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    "interview_panel"
  );
  // Assessed wins over assigned
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "stage_1_submitted",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    "assessed"
  );
});

test("counts use complete population and agree with filter definitions; drafts excluded", () => {
  const apps = [
    app("d1", "draft"),
    app("u1", "stage_1_submitted"),
    app("as1", "stage_1_submitted"),
    app("ae1", "stage_1_submitted"),
    app("i1", "interview_review_pending"),
    app("i2", "called_for_interview"),
  ];
  const operational = apps.filter((a) => a.status !== "draft");
  const map = buildDirectorAssignmentWorkflowMap(
    [
      {
        application_id: "as1",
        assessor_id: ASSESSOR_A,
        status: "active",
        profiles: { full_name: "A" },
      },
      {
        application_id: "ae1",
        assessor_id: ASSESSOR_A,
        status: "active",
        profiles: { full_name: "A" },
      },
    ],
    [
      {
        application_id: "ae1",
        assessor_id: ASSESSOR_A,
        stage: "stage_1",
        recommendation: "recommend_progress",
        submitted_at: "2026-01-01",
      },
    ],
    Object.fromEntries(operational.map((a) => [a.id, a.status]))
  );

  const classified = classifyDirectorApplications(operational, map);
  const counts = summarizeDirectorWorkflowCounts(classified);

  assert.equal(counts.all, 5);
  assert.equal(counts.unassigned, 1);
  assert.equal(counts.assigned, 1);
  assert.equal(counts.assessed, 1);
  assert.equal(counts.interview_panel, 2);
  assert.equal(
    counts.all,
    counts.unassigned + counts.assigned + counts.assessed + counts.interview_panel
  );

  assert.equal(filterByDirectorWorkflow(classified, "unassigned").length, counts.unassigned);
  assert.equal(filterByDirectorWorkflow(classified, "assigned").length, counts.assigned);
  assert.equal(filterByDirectorWorkflow(classified, "assessed").length, counts.assessed);
  assert.equal(
    filterByDirectorWorkflow(classified, "interview_panel").length,
    counts.interview_panel
  );
  assert.equal(filterByDirectorWorkflow(classified, "all").length, counts.all);
});

test("terminal applications stay in All Submitted and Status views, not actionable queues", () => {
  const apps = [
    app("acc", "accepted", { full_name: "Accepted Person" }),
    app("rej", "rejected", { full_name: "Rejected Person" }),
    app("open", "stage_1_submitted", { full_name: "Open Person" }),
  ];
  const classified = classifyDirectorApplications(apps, {});
  const counts = summarizeDirectorWorkflowCounts(classified);

  // All Submitted includes terminals
  assert.equal(counts.all, 3);
  assert.equal(filterByDirectorWorkflow(classified, "all").length, 3);
  assert.ok(filterByDirectorWorkflow(classified, "all").some((r) => r.app.status === "accepted"));
  assert.ok(filterByDirectorWorkflow(classified, "all").some((r) => r.app.status === "rejected"));

  // Not Unassigned / Assigned / Assessed / Interview
  assert.equal(classifyDirectorWorkflowStage({ status: "accepted" }), null);
  assert.equal(classifyDirectorWorkflowStage({ status: "rejected" }), null);
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "accepted",
      hasActiveAssignment: false,
      hasCompletedAssessmentForAssignee: false,
    }),
    null
  );
  // Even with a stale active assignment, terminal is not an actionable queue
  assert.equal(
    classifyDirectorWorkflowStage({
      status: "accepted",
      hasActiveAssignment: true,
      hasCompletedAssessmentForAssignee: true,
    }),
    null
  );

  assert.equal(filterByDirectorWorkflow(classified, "unassigned").length, 1);
  assert.equal(filterByDirectorWorkflow(classified, "unassigned")[0].app.id, "open");
  assert.equal(filterByDirectorWorkflow(classified, "assigned").length, 0);
  assert.equal(filterByDirectorWorkflow(classified, "assessed").length, 0);
  assert.equal(filterByDirectorWorkflow(classified, "interview_panel").length, 0);

  // Actionable queues do not sum to All Submitted when terminals exist
  const actionable =
    counts.unassigned + counts.assigned + counts.assessed + counts.interview_panel;
  assert.equal(actionable, 1);
  assert.ok(counts.all > actionable);

  // Status filter composition: Accepted + All → accepted only
  const acceptedStatus = filterByDirectorWorkflow(
    classified.filter((r) => r.app.status === "accepted"),
    "all"
  );
  assert.equal(acceptedStatus.length, 1);
  assert.equal(acceptedStatus[0].app.id, "acc");

  // Status = Accepted + Workflow = Unassigned → empty (preferable to mislabeling)
  const acceptedUnassigned = filterByDirectorWorkflow(
    classified.filter((r) => r.app.status === "accepted"),
    "unassigned"
  );
  assert.equal(acceptedUnassigned.length, 0);

  const rejectedStatus = filterByDirectorWorkflow(
    classified.filter((r) => r.app.status === "rejected"),
    "all"
  );
  assert.equal(rejectedStatus.length, 1);
});

test("transitions: assign / unassign / assess / interview progression", () => {
  // Unassigned → Assigned
  let stage = classifyDirectorWorkflowStage({
    status: "stage_1_submitted",
    hasActiveAssignment: false,
    hasCompletedAssessmentForAssignee: false,
  });
  assert.equal(stage, "unassigned");
  stage = classifyDirectorWorkflowStage({
    status: "stage_1_submitted",
    hasActiveAssignment: true,
    hasCompletedAssessmentForAssignee: false,
  });
  assert.equal(stage, "assigned");

  // Assigned → Unassigned
  stage = classifyDirectorWorkflowStage({
    status: "stage_1_submitted",
    hasActiveAssignment: false,
    hasCompletedAssessmentForAssignee: false,
  });
  assert.equal(stage, "unassigned");

  // Assigned → Assessed
  stage = classifyDirectorWorkflowStage({
    status: "stage_1_submitted",
    hasActiveAssignment: true,
    hasCompletedAssessmentForAssignee: true,
  });
  assert.equal(stage, "assessed");

  // Assessed → Interview/Panel when official status advances
  stage = classifyDirectorWorkflowStage({
    status: "interview_review_pending",
    hasActiveAssignment: true,
    hasCompletedAssessmentForAssignee: true,
  });
  assert.equal(stage, "interview_panel");
});

test("search matches within a workflow-filtered set and empty query restores filter set", () => {
  const rows = classifyDirectorApplications(
    [
      app("j1", "stage_1_submitted", {
        full_name: "Juliana Adenkia",
        email: "juliana@example.com",
      }),
      app("s1", "stage_1_submitted", {
        full_name: "Sheila Mensah",
        email: "sheila@example.com",
      }),
    ],
    {}
  );
  const unassigned = filterByDirectorWorkflow(rows, "unassigned");
  assert.equal(unassigned.length, 2);

  const juliana = unassigned.filter((row) =>
    directorApplicationMatchesSearch(row.app, "  Juliana  ")
  );
  assert.equal(juliana.length, 1);
  assert.equal(juliana[0].app.id, "j1");

  const restored = unassigned.filter((row) => directorApplicationMatchesSearch(row.app, ""));
  assert.equal(restored.length, unassigned.length);

  // Search within Assessed does not silently drop workflow
  const assessedOnly = filterByDirectorWorkflow(
    classifyDirectorApplications(
      [app("a1", "stage_1_submitted", { full_name: "Juliana Adenkia" })],
      {
        a1: { assessor_id: ASSESSOR_A, hasAssessment: true, label: "Assessment submitted by A" },
      }
    ),
    "assessed"
  );
  assert.equal(assessedOnly.length, 1);
  assert.equal(
    assessedOnly.filter((row) => directorApplicationMatchesSearch(row.app, "Juliana")).length,
    1
  );
  assert.equal(
    assessedOnly.filter((row) => directorApplicationMatchesSearch(row.app, "Nobody")).length,
    0
  );
});

test("search works for each workflow key without resetting the filter key", () => {
  for (const { key } of DIRECTOR_WORKFLOW_FILTERS) {
    const scoped = filterByDirectorWorkflow(
      [
        {
          workflow: key === "all" ? "unassigned" : key,
          app: app("x", "stage_1_submitted", { full_name: "Pat Target" }),
        },
      ],
      key
    );
    assert.ok(scoped.length >= 1 || key === "all");
    const hit = scoped.filter((row) => directorApplicationMatchesSearch(row.app, "Pat"));
    assert.equal(hit.length, scoped.length > 0 ? 1 : 0);
  }
});

test("Director applications page wires workflow filters, counts, search, and auth", () => {
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  const list = readFileSync(
    resolve("components/director/DirectorApplicationsList.jsx"),
    "utf8"
  );
  const helper = readFileSync(resolve("lib/director-application-workflow.js"), "utf8");
  assert.match(page, /DIRECTOR_WORKFLOW_FILTERS/);
  assert.match(page, /summarizeDirectorWorkflowCounts/);
  assert.match(page, /classifyDirectorApplications/);
  assert.match(page, /isDirectorRole/);
  assert.match(page, /DIRECTOR_PRIMARY_FILTERS/);
  assert.match(page, /set\("workflow"/);
  assert.match(page, /params\?\.workflow/);
  assert.match(helper, /All Submitted/);
  assert.match(helper, /Unassigned/);
  assert.match(helper, /Assigned/);
  assert.match(helper, /Assessed/);
  assert.match(helper, /Interview \/ Panel/);
  assert.match(list, /directorApplicationMatchesSearch/);
  assert.match(list, /Clear search/);
  assert.match(list, /\/director\/applications\/\$\{app\.id\}/);
});

test("canonical terminal statuses are only accepted and rejected", () => {
  assert.deepEqual(DIRECTOR_TERMINAL_STATUSES, ["accepted", "rejected"]);
  const emptyOutgoing = Object.entries(STATUS_TRANSITIONS)
    .filter(([, next]) => Array.isArray(next) && next.length === 0)
    .map(([status]) => status)
    .sort();
  assert.deepEqual(emptyOutgoing, ["accepted", "rejected"]);
  assert.equal(isDirectorTerminalStatus("accepted"), true);
  assert.equal(isDirectorTerminalStatus("rejected"), true);
  assert.equal(isDirectorTerminalStatus("interview"), false);
  assert.equal(isDirectorTerminalStatus("stage_1_submitted"), false);
});

test("workflow helper does not invent new application statuses", () => {
  const src = readFileSync(resolve("lib/director-application-workflow.js"), "utf8");
  assert.doesNotMatch(src, /workflow_status/);
  for (const status of DIRECTOR_INTERVIEW_PANEL_STATUSES) {
    assert.ok(DIRECTOR_PENDING_STATUSES.includes(status), `${status} already pending`);
  }
  for (const status of DIRECTOR_TERMINAL_STATUSES) {
    assert.equal(DIRECTOR_PENDING_STATUSES.includes(status), false);
  }
});

test("security: applications page remains Director-gated; no public workflow API added", () => {
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.match(page, /isDirectorRole/);
  assert.match(page, /redirect\("\/director-login"\)/);
  // Classification is local helper — list still loaded server-side under Director session
  assert.match(page, /loadAssignmentWorkflowMeta|buildDirectorAssignmentWorkflowMap/);
  assert.doesNotMatch(page, /export async function GET/);
});
