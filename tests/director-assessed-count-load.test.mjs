import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SUPABASE_IN_FILTER_CHUNK_SIZE,
  chunkIdsForInFilter,
  fetchAllRowsForIds,
} from "../lib/director-application-scope.js";
import {
  buildDirectorAssignmentWorkflowMap,
  classifyDirectorApplications,
  filterByDirectorWorkflow,
  summarizeSelectedAssessorWorkload,
} from "../lib/director-application-workflow.js";
import {
  DIRECTOR_ASSESSMENT_WORKFLOW_SELECT,
  loadDirectorAssignmentWorkflowMeta,
} from "../lib/director-assignment-workflow-meta.js";

const ASSESSOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ASSESSOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function app(id, status) {
  return { id, status, full_name: `Applicant ${id}` };
}

function active(applicationId, assessorId, name = "Ada") {
  return {
    application_id: applicationId,
    assessor_id: assessorId,
    status: "active",
    profiles: { full_name: name, email: `${name}@example.com`, is_active: true },
  };
}

function assessment(applicationId, assessorId, stage, extras = {}) {
  return {
    application_id: applicationId,
    assessor_id: assessorId,
    stage,
    recommendation: extras.recommendation || "recommend_progress",
    submitted_at: extras.submitted_at || "2026-10-01T12:00:00.000Z",
    assessor_name_snapshot: extras.name || "Ada",
  };
}

test("chunkIdsForInFilter splits large ID lists below PostgREST URL risk", () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
  const chunks = chunkIdsForInFilter(ids, 100);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 100);
  assert.equal(chunks[1].length, 100);
  assert.equal(chunks[2].length, 50);
  assert.equal(SUPABASE_IN_FILTER_CHUNK_SIZE, 100);
});

test("chunkIdsForInFilter dedupes and drops blanks", () => {
  assert.deepEqual(chunkIdsForInFilter(["a", "a", "", null, "b"], 10), [["a", "b"]]);
  assert.deepEqual(chunkIdsForInFilter([], 10), []);
});

test("fetchAllRowsForIds issues chunked queries and merges pages", async () => {
  const calls = [];
  const buildQuery = (chunkIds) => {
    calls.push([...chunkIds]);
    return {
      range: async (from, to) => {
        // One page per chunk
        assert.equal(from, 0);
        assert.ok(to >= from);
        return {
          data: chunkIds.map((id) => ({ application_id: id, ok: true })),
          error: null,
        };
      },
    };
  };

  const ids = Array.from({ length: 150 }, (_, i) => `app-${i}`);
  const { data, error } = await fetchAllRowsForIds(buildQuery, ids, { idChunkSize: 100 });
  assert.equal(error, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].length, 100);
  assert.equal(calls[1].length, 50);
  assert.equal(data.length, 150);
});

test("fetchAllRowsForIds surfaces query errors without inventing rows", async () => {
  const buildQuery = () => ({
    range: async () => ({ data: null, error: { message: "URI too long", code: "414" } }),
  });
  const { data, error } = await fetchAllRowsForIds(buildQuery, ["a", "b"], { idChunkSize: 100 });
  assert.equal(data.length, 0);
  assert.equal(error.message, "URI too long");
});

test("A: active assignment + completed assessment → assessed", () => {
  const apps = [app("x1", "stage_1_submitted")];
  const map = buildDirectorAssignmentWorkflowMap(
    [active("x1", ASSESSOR_A)],
    [assessment("x1", ASSESSOR_A, "stage_1")],
    { x1: "stage_1_submitted" }
  );
  const classified = classifyDirectorApplications(apps, map);
  assert.equal(classified[0].workflow, "assessed");
  assert.equal(map.x1.hasAssessment, true);
});

test("B: active assignment + no assessment → assigned/awaiting", () => {
  const apps = [app("x1", "stage_1_submitted")];
  const map = buildDirectorAssignmentWorkflowMap(
    [active("x1", ASSESSOR_A)],
    [],
    { x1: "stage_1_submitted" }
  );
  const classified = classifyDirectorApplications(apps, map);
  assert.equal(classified[0].workflow, "assigned");
});

test("C: active assignment + incomplete (missing) assessment → awaiting", () => {
  // Completion is row presence for assignee+stage; no draft/incomplete status in schema.
  const classified = classifyDirectorApplications(
    [app("x1", "stage_1_submitted")],
    buildDirectorAssignmentWorkflowMap([active("x1", ASSESSOR_A)], [], {
      x1: "stage_1_submitted",
    })
  );
  assert.equal(classified[0].workflow, "assigned");
});

test("D: reassigned historical assessor assessment does not count for old assessor workload", () => {
  // Only active assignment is B; A's historical assessment must not mark current map assessed via A.
  const apps = [app("x1", "stage_1_submitted")];
  const map = buildDirectorAssignmentWorkflowMap(
    [active("x1", ASSESSOR_B, "Ben")],
    [assessment("x1", ASSESSOR_A, "stage_1", { name: "Ada" })],
    { x1: "stage_1_submitted" }
  );
  assert.equal(map.x1.assessor_id, ASSESSOR_B);
  assert.equal(map.x1.hasAssessment, false);
  const classified = classifyDirectorApplications(apps, map);
  assert.equal(classified[0].workflow, "assigned");
  const summaryA = summarizeSelectedAssessorWorkload(classified, ASSESSOR_A);
  assert.equal(summaryA.total, 0);
  assert.equal(summaryA.assessed, 0);
});

test("E: new active assessor + completed current assessment → assessed", () => {
  const apps = [app("x1", "stage_1_submitted")];
  const map = buildDirectorAssignmentWorkflowMap(
    [active("x1", ASSESSOR_B, "Ben")],
    [
      assessment("x1", ASSESSOR_A, "stage_1", { name: "Ada" }),
      assessment("x1", ASSESSOR_B, "stage_1", { name: "Ben" }),
    ],
    { x1: "stage_1_submitted" }
  );
  assert.equal(map.x1.hasAssessment, true);
  assert.equal(classifyDirectorApplications(apps, map)[0].workflow, "assessed");
});

test("F: Stage 1 completed assessment recognized", () => {
  const map = buildDirectorAssignmentWorkflowMap(
    [active("s1", ASSESSOR_A)],
    [assessment("s1", ASSESSOR_A, "stage_1")],
    { s1: "review_pending" }
  );
  assert.equal(map.s1.hasAssessment, true);
});

test("G: Stage 2 completed assessment recognized", () => {
  const map = buildDirectorAssignmentWorkflowMap(
    [active("s2", ASSESSOR_A)],
    [assessment("s2", ASSESSOR_A, "stage_2")],
    { s2: "stage_2_submitted" }
  );
  assert.equal(map.s2.hasAssessment, true);
  assert.equal(
    classifyDirectorApplications([app("s2", "stage_2_submitted")], map)[0].workflow,
    "assessed"
  );
});

test("H: stage_1 assessment does not satisfy stage_2 current requirement", () => {
  const map = buildDirectorAssignmentWorkflowMap(
    [active("s2", ASSESSOR_A)],
    [assessment("s2", ASSESSOR_A, "stage_1")],
    { s2: "stage_2_submitted" }
  );
  assert.equal(map.s2.hasAssessment, false);
});

test("empty assessments (failed load shape) yield all awaiting — reproduces Esinam symptom", () => {
  const apps = Array.from({ length: 20 }, (_, i) => app(`a${i}`, "stage_1_submitted"));
  const assignments = apps.map((a) => active(a.id, ASSESSOR_A, "Esinam"));
  // Simulate silent failed assessment query → []
  const map = buildDirectorAssignmentWorkflowMap(assignments, [], Object.fromEntries(apps.map((a) => [a.id, a.status])));
  const classified = classifyDirectorApplications(apps, map);
  const summary = summarizeSelectedAssessorWorkload(classified, ASSESSOR_A);
  assert.equal(summary.total, 20);
  assert.equal(summary.assessed, 0);
  assert.equal(summary.awaiting, 20);
});

test("loaded assessments reconcile assessed + awaiting for assignable stages", () => {
  const apps = [
    app("done1", "stage_1_submitted"),
    app("done2", "stage_1_submitted"),
    app("wait1", "stage_1_submitted"),
  ];
  const assignments = apps.map((a) => active(a.id, ASSESSOR_A, "Esinam"));
  const assessments = [
    assessment("done1", ASSESSOR_A, "stage_1"),
    assessment("done2", ASSESSOR_A, "stage_1"),
  ];
  const map = buildDirectorAssignmentWorkflowMap(
    assignments,
    assessments,
    Object.fromEntries(apps.map((a) => [a.id, a.status]))
  );
  const classified = classifyDirectorApplications(apps, map);
  const summary = summarizeSelectedAssessorWorkload(classified, ASSESSOR_A);
  assert.equal(summary.total, 3);
  assert.equal(summary.assessed, 2);
  assert.equal(summary.awaiting, 1);
  assert.equal(summary.assessed + summary.awaiting, summary.total);
  assert.equal(filterByDirectorWorkflow(classified, "assessed").length, 2);
  assert.equal(filterByDirectorWorkflow(classified, "assigned").length, 1);
});

test("assessor_id match is case-insensitive (UUID casing)", () => {
  const map = buildDirectorAssignmentWorkflowMap(
    [active("x1", ASSESSOR_A.toUpperCase())],
    [assessment("x1", ASSESSOR_A.toLowerCase(), "stage_1")],
    { x1: "stage_1_submitted" }
  );
  assert.equal(map.x1.hasAssessment, true);
});

test("loadDirectorAssignmentWorkflowMeta uses chunked assessment fetch", async () => {
  const assessmentCalls = [];
  const admin = {
    from(table) {
      if (table === "assessor_assignments") {
        return {
          select() {
            return {
              eq() {
                return {
                  range: async () => ({
                    data: [
                      active("app-1", ASSESSOR_A),
                      active("app-2", ASSESSOR_A),
                    ],
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }
      if (table === "application_assessments") {
        return {
          select(cols) {
            assert.match(cols, /assessor_id/);
            assert.match(cols, /stage/);
            return {
              in(_col, chunkIds) {
                assessmentCalls.push(chunkIds);
                return {
                  order() {
                    return {
                      range: async () => ({
                        data: chunkIds.map((id) =>
                          assessment(id, ASSESSOR_A, "stage_1")
                        ),
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const map = await loadDirectorAssignmentWorkflowMeta(
    admin,
    [app("app-1", "stage_1_submitted"), app("app-2", "stage_1_submitted")],
    { logLabel: "test" }
  );
  assert.equal(assessmentCalls.length, 1);
  assert.equal(map["app-1"].hasAssessment, true);
  assert.equal(map["app-2"].hasAssessment, true);
});

test("Director Applications page uses shared chunked meta loader (no bare giant .in)", () => {
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.match(page, /loadDirectorAssignmentWorkflowMeta/);
  assert.doesNotMatch(page, /\.in\(\s*["']application_id["']/);
  const meta = readFileSync(resolve("lib/director-assignment-workflow-meta.js"), "utf8");
  assert.match(meta, /fetchAllRowsForIds/);
  assert.match(meta, /application_assessments/);
  assert.ok(meta.includes(DIRECTOR_ASSESSMENT_WORKFLOW_SELECT.split(",")[0].trim()));
});

test("Communications audience resolution uses shared chunked meta loader", () => {
  const src = readFileSync(resolve("lib/director-communications.js"), "utf8");
  assert.match(src, /loadDirectorAssignmentWorkflowMeta/);
  assert.doesNotMatch(src, /\.in\(\s*["']application_id["']/);
});
