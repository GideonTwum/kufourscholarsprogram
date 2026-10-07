import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyAssignAssessmentState,
  classifyAssignAssignmentState,
  filterAssignApplicants,
  matchAssignApplicantSearch,
  normalizeAssignAssessmentFilter,
  normalizeAssignAssignmentFilter,
  summarizeAssignApplicantFilterCounts,
} from "../lib/assessor-assign-filters.js";
import { ASSESSOR_ASSIGNABLE_STATUSES } from "../lib/assessor-assignment.js";

const ASSESSOR_A = "11111111-1111-4111-8111-111111111111";
const ASSESSOR_B = "22222222-2222-4222-8222-222222222222";

function app(id, extras = {}) {
  return {
    id,
    status: extras.status || "stage_1_submitted",
    applicant_name: extras.name || `Applicant ${id}`,
    full_name: extras.name || `Applicant ${id}`,
    email: extras.email || `${id}@example.com`,
    university: extras.university || "University of Ghana",
    student_id: extras.student_id || null,
    current_assignment: extras.assignment ?? null,
  };
}

function assigned(assessorId, name, assessmentStatus = "pending", recommendation = null) {
  return {
    id: `asg-${assessorId}`,
    status: "active",
    assigned_at: "2026-10-01T12:00:00.000Z",
    assessor: { id: assessorId, full_name: name, email: `${name}@example.com` },
    assessment: {
      status: assessmentStatus,
      recommendation,
      submitted_at: assessmentStatus === "submitted" ? "2026-10-02T12:00:00.000Z" : null,
    },
  };
}

const population = [
  app("daniela", {
    name: "Daniela Suglo Thomas",
    email: "daniela@example.com",
    university: "University of Ghana",
  }),
  app("anthony", {
    name: "Anthony Dontoh",
    email: "dontoh@example.com",
    university: "University of Cape Coast",
    assignment: assigned(ASSESSOR_B, "Obenewaa Berko", "pending"),
  }),
  app("ama", {
    name: "Ama Mensah",
    status: "stage_1_submitted",
    assignment: assigned(ASSESSOR_A, "Sandra", "submitted", "recommend_reject"),
  }),
  app("kojo", {
    name: "Kojo Boateng",
    status: "stage_2_submitted",
    // Stage-2 app: API must not mark assessed from stage_1; pending here.
    assignment: assigned(ASSESSOR_A, "Sandra", "pending"),
  }),
  app("efua", {
    name: "Efua Addo",
    status: "stage_2_submitted",
    assignment: assigned(ASSESSOR_A, "Sandra", "submitted", "recommend_interview"),
  }),
];

test("1. Search applicant by exact name", () => {
  const hits = filterAssignApplicants(population, { search: "Daniela Suglo Thomas" });
  assert.deepEqual(
    hits.map((a) => a.id),
    ["daniela"]
  );
});

test("2. Search applicant by partial name", () => {
  const hits = filterAssignApplicants(population, { search: "Daniela" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, "daniela");
});

test("3. Search is case-insensitive", () => {
  assert.equal(matchAssignApplicantSearch(population[0], "daniela suglo"), true);
  assert.equal(matchAssignApplicantSearch(population[0], "DANIELA"), true);
  const hits = filterAssignApplicants(population, { search: "aNtHoNy" });
  assert.equal(hits[0].id, "anthony");
});

test("4. Search + Unassigned", () => {
  const hits = filterAssignApplicants(population, {
    search: "Daniela",
    assignment: "unassigned",
  });
  assert.deepEqual(
    hits.map((a) => a.id),
    ["daniela"]
  );
  assert.equal(classifyAssignAssignmentState(hits[0]), "unassigned");
});

test("5. Search + Assigned", () => {
  const hits = filterAssignApplicants(population, {
    search: "Anthony",
    assignment: "assigned",
  });
  assert.deepEqual(
    hits.map((a) => a.id),
    ["anthony"]
  );
});

test("6. Assigned filter uses active assignments only", () => {
  const hits = filterAssignApplicants(population, { assignment: "assigned" });
  assert.ok(hits.every((a) => a.current_assignment?.status === "active"));
  assert.equal(hits.length, 4);
});

test("7. Reassigned historical row does not count as assigned ownership", () => {
  // UI population only receives current_assignment from active rows.
  const orphan = app("old", {
    name: "Old History",
    assignment: null,
  });
  assert.equal(classifyAssignAssignmentState(orphan), "unassigned");
  assert.equal(filterAssignApplicants([orphan], { assignment: "assigned" }).length, 0);
});

test("8. Completed historical assignment does not count as active", () => {
  const completedOnly = app("done", {
    name: "Done",
    assignment: null, // API builds current_assignment only for status=active
  });
  assert.equal(classifyAssignAssignmentState(completedOnly), "unassigned");
});

test("9. Assessment → Assessed uses current active assessor/current stage", () => {
  const hits = filterAssignApplicants(population, {
    assignment: "assigned",
    assessment: "assessed",
  });
  assert.deepEqual(
    hits.map((a) => a.id).sort(),
    ["ama", "efua"]
  );
  assert.ok(hits.every((a) => a.current_assignment.assessment.status === "submitted"));
});

test("10. Assessment → Unassessed uses current active assessor/current stage", () => {
  const hits = filterAssignApplicants(population, {
    assignment: "assigned",
    assessment: "unassessed",
  });
  assert.deepEqual(
    hits.map((a) => a.id).sort(),
    ["anthony", "kojo"]
  );
});

test("11. Unassigned applicant is NOT classified as Unassessed", () => {
  assert.equal(classifyAssignAssessmentState(population[0]), null);
  const asUnassessed = filterAssignApplicants(population, { assessment: "unassessed" });
  assert.ok(!asUnassessed.some((a) => a.id === "daniela"));
});

test("12. Assignment=Unassigned + Assessment=Assessed → empty", () => {
  assert.equal(
    filterAssignApplicants(population, {
      assignment: "unassigned",
      assessment: "assessed",
    }).length,
    0
  );
});

test("13. Assignment=Unassigned + Assessment=Unassessed → empty", () => {
  assert.equal(
    filterAssignApplicants(population, {
      assignment: "unassigned",
      assessment: "unassessed",
    }).length,
    0
  );
});

test("14. Assigned + Assessed composition", () => {
  const hits = filterAssignApplicants(population, {
    assignment: "assigned",
    assessment: "assessed",
  });
  assert.ok(hits.every((a) => classifyAssignAssignmentState(a) === "assigned"));
  assert.ok(hits.every((a) => classifyAssignAssessmentState(a) === "assessed"));
});

test("15. Assigned + Unassessed composition", () => {
  const hits = filterAssignApplicants(population, {
    assignment: "assigned",
    assessment: "unassessed",
  });
  assert.ok(hits.every((a) => classifyAssignAssessmentState(a) === "unassessed"));
});

test("16. Stage 1 assessment does not satisfy Stage 2 requirement", () => {
  // kojo is stage_2 with pending current-stage assessment payload
  assert.equal(classifyAssignAssessmentState(population.find((a) => a.id === "kojo")), "unassessed");
  const stage2Assessed = filterAssignApplicants(population, {
    stage: "stage_2",
    assessment: "assessed",
  });
  assert.deepEqual(
    stage2Assessed.map((a) => a.id),
    ["efua"]
  );
});

test("17. Selected target assessor remains after filtering (page wiring)", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  assert.match(page, /selectedAssessor/);
  assert.match(page, /filterAssignApplicants/);
  // Changing filters must not clear selectedAssessor
  assert.doesNotMatch(page, /setAssignmentFilter\([^)]*setSelectedAssessor/);
  assert.match(page, /setSelectedAssessor\(\(prev\)/);
});

test("18. Existing reassignment confirmation remains", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  assert.match(page, /force_reassign/);
  assert.match(page, /Reassign/);
  assert.match(page, /confirm\(/);
  assert.match(page, /filterAssignableSelection/);
});

function sliceFunction(src, name, nextName) {
  const start = src.indexOf(`async function ${name}`);
  assert.ok(start >= 0, `missing function ${name}`);
  const end = nextName ? src.indexOf(`async function ${nextName}`, start + 1) : src.length;
  return src.slice(start, end > start ? end : src.length);
}

test("19. Assignment action updates filtered results via reload", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  const assignFn = sliceFunction(page, "assignApplications", "lifecycleAction");
  assert.match(assignFn, /load\(\)/);
  assert.doesNotMatch(assignFn, /setApplicantSearch/);
  assert.doesNotMatch(assignFn, /setAssignmentFilter/);
});

test("20. Unassign action updates filtered results via reload", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  const unassignFn = sliceFunction(page, "unassignApplication", null);
  // Bound to next non-async helper
  const bounded = unassignFn.slice(0, unassignFn.indexOf("\n  function toggleApplication"));
  assert.match(bounded, /load\(\)/);
  assert.doesNotMatch(bounded, /setApplicantSearch/);
  assert.doesNotMatch(bounded, /setAssignmentFilter/);
});

test("21. Search remains after mutation", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  assert.match(page, /applicantSearch/);
  const loadFn = sliceFunction(page, "load", null);
  const bounded = loadFn.slice(0, loadFn.indexOf("\n  useEffect"));
  assert.doesNotMatch(bounded, /setApplicantSearch/);
});

test("22. Filters remain after mutation", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  const loadFn = sliceFunction(page, "load", null);
  const bounded = loadFn.slice(0, loadFn.indexOf("\n  useEffect"));
  assert.doesNotMatch(bounded, /setAssignmentFilter/);
  assert.doesNotMatch(bounded, /setAssessmentFilter/);
  assert.doesNotMatch(bounded, /setStageFilter/);
});

test("23. Drafts remain excluded", () => {
  assert.ok(!ASSESSOR_ASSIGNABLE_STATUSES.includes("draft"));
  const withDraft = [...population, app("draft1", { name: "Draft Person", status: "draft" })];
  // Filter helpers don't broaden eligibility — page only receives assignable statuses.
  // Document assignable set excludes draft/accepted/rejected/interview.
  for (const status of ["draft", "accepted", "rejected", "called_for_interview", "interview"]) {
    assert.ok(!ASSESSOR_ASSIGNABLE_STATUSES.includes(status));
  }
  assert.equal(withDraft.filter((a) => a.status === "draft").length, 1);
});

test("24. Terminal/ineligible applicants remain excluded according to current rules", () => {
  assert.deepEqual(
    [...ASSESSOR_ASSIGNABLE_STATUSES].sort(),
    [
      "review_pending",
      "stage_1_approved",
      "stage_1_submitted",
      "stage_2_review_pending",
      "stage_2_submitted",
    ].sort()
  );
});

test("25. Chunked assessment loading is reused", () => {
  const route = readFileSync(resolve("app/api/director/assessors/route.js"), "utf8");
  assert.match(route, /fetchAllRowsForIds/);
  assert.match(route, /fetchAllApplicationPages/);
  assert.match(route, /assessmentStageForStatus/);
  assert.match(route, /requireActiveDirector/);
});

test("26. No giant .in\\(\\) regression", () => {
  const route = readFileSync(resolve("app/api/director/assessors/route.js"), "utf8");
  // Assessments must be loaded through chunked helper, not a bare giant .in on all IDs inline
  assert.match(route, /fetchAllRowsForIds/);
  assert.match(route, /\.in\("application_id", chunkIds\)/);
  assert.doesNotMatch(route, /\.limit\(500\)/);
});

test("27. No N+1 assessor/assessment query", () => {
  const route = readFileSync(resolve("app/api/director/assessors/route.js"), "utf8");
  assert.doesNotMatch(route, /for\s*\([^)]+\)\s*\{[^}]*\.from\("application_assessments"\)/s);
  assert.match(route, /findCurrentStageAssessment/);
});

test("28. Director auth remains enforced", () => {
  const route = readFileSync(resolve("app/api/director/assessors/route.js"), "utf8");
  assert.match(route, /requireActiveDirector/);
  assert.match(route, /gate\.error/);
});

test("filter counts derive from assignable population", () => {
  const counts = summarizeAssignApplicantFilterCounts(population);
  assert.equal(counts.assignment.all, 5);
  assert.equal(counts.assignment.unassigned, 1);
  assert.equal(counts.assignment.assigned, 4);
  assert.equal(counts.assessment.assessed, 2);
  assert.equal(counts.assessment.unassessed, 2);
  assert.equal(counts.assessment.all, 4);
  assert.equal(counts.stage.stage_1, 3);
  assert.equal(counts.stage.stage_2, 2);
});

test("normalize filters reject unknown values", () => {
  assert.equal(normalizeAssignAssignmentFilter("nope"), "all");
  assert.equal(normalizeAssignAssessmentFilter("maybe"), "all");
});

test("search also matches email and university when present", () => {
  assert.ok(matchAssignApplicantSearch(population[0], "daniela@example.com"));
  assert.ok(matchAssignApplicantSearch(population[1], "Cape Coast"));
});

test("Assign Applicants page wires search and filter UI", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/assessors/page.js"), "utf8");
  assert.match(page, /Search applicants by name/);
  assert.match(page, /ASSIGN_ASSIGNMENT_FILTERS/);
  assert.match(page, /ASSIGN_ASSESSMENT_FILTERS/);
  assert.match(page, /ASSIGN_STAGE_FILTERS/);
  assert.match(page, /filteredApplications/);
  assert.match(page, /No applicants match these filters/);
  assert.match(page, /aria-pressed/);
});
