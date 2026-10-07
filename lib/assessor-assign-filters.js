/**
 * Assign Applicants panel filters (Director → Assessors).
 *
 * Operates within the existing assignable population only.
 * Assessment filters reuse current-stage completion semantics from
 * application_assessments + assessmentStageForStatus (via current_assignment.assessment).
 */

import { classifyDirectorApplicationStage } from "./director-application-scope.js";

export const ASSIGN_ASSIGNMENT_FILTERS = [
  { key: "all", label: "All" },
  { key: "unassigned", label: "Unassigned" },
  { key: "assigned", label: "Assigned" },
];

export const ASSIGN_ASSESSMENT_FILTERS = [
  { key: "all", label: "All" },
  { key: "unassessed", label: "Unassessed" },
  { key: "assessed", label: "Assessed" },
];

/** Stage chips for Assign Applicants — Stage 1 / Stage 2 only (no Interview/Panel). */
export const ASSIGN_STAGE_FILTERS = [
  { key: "all", label: "All Stages" },
  { key: "stage_1", label: "Stage 1" },
  { key: "stage_2", label: "Stage 2" },
];

/**
 * @param {string|null|undefined} raw
 * @returns {"all"|"unassigned"|"assigned"}
 */
export function normalizeAssignAssignmentFilter(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key === "all") return "all";
  if (key === "assigned" || key === "unassigned") return key;
  return "all";
}

/**
 * @param {string|null|undefined} raw
 * @returns {"all"|"assessed"|"unassessed"}
 */
export function normalizeAssignAssessmentFilter(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key === "all") return "all";
  if (key === "assessed" || key === "unassessed") return key;
  return "all";
}

/**
 * @param {string|null|undefined} raw
 * @returns {"all"|"stage_1"|"stage_2"}
 */
export function normalizeAssignStageFilter(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key === "all") return "all";
  if (key === "stage_1" || key === "stage_2") return key;
  return "all";
}

/**
 * @param {object|null|undefined} app
 * @returns {boolean}
 */
export function hasActiveAssignAssignment(app) {
  return Boolean(app?.current_assignment);
}

/**
 * Current-stage assessed for the ACTIVE assignee.
 * Relies on API attaching assessment only when it matches current stage.
 *
 * @param {object|null|undefined} app
 * @returns {boolean}
 */
export function hasCurrentStageAssessmentSubmitted(app) {
  if (!hasActiveAssignAssignment(app)) return false;
  return app.current_assignment?.assessment?.status === "submitted";
}

/**
 * Assignment bucket for filters.
 * @returns {"assigned"|"unassigned"}
 */
export function classifyAssignAssignmentState(app) {
  return hasActiveAssignAssignment(app) ? "assigned" : "unassigned";
}

/**
 * Assessment bucket for filters.
 * Unassigned applicants are NOT "unassessed" — returns null (not applicable).
 *
 * @returns {"assessed"|"unassessed"|null}
 */
export function classifyAssignAssessmentState(app) {
  if (!hasActiveAssignAssignment(app)) return null;
  return hasCurrentStageAssessmentSubmitted(app) ? "assessed" : "unassessed";
}

/**
 * Case-insensitive search over name (required) plus email / university / student_id when present.
 * @param {object} app
 * @param {string} query
 */
export function matchAssignApplicantSearch(app, query) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (!q) return true;
  const hay = [
    app?.applicant_name,
    app?.full_name,
    app?.profiles?.full_name,
    app?.email,
    app?.profiles?.email,
    app?.university,
    app?.student_id,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Filter assignable applicants with AND composition.
 *
 * Conflicting pairs (Unassigned + Assessed/Unassessed) yield empty results.
 *
 * @param {Array<object>} applications
 * @param {{
 *   search?: string,
 *   assignment?: string,
 *   assessment?: string,
 *   stage?: string,
 * }} filters
 */
export function filterAssignApplicants(applications, filters = {}) {
  const list = Array.isArray(applications) ? applications : [];
  const assignment = normalizeAssignAssignmentFilter(filters.assignment);
  const assessment = normalizeAssignAssessmentFilter(filters.assessment);
  const stage = normalizeAssignStageFilter(filters.stage);
  const search = typeof filters.search === "string" ? filters.search : "";

  // Assessment filters require an active assignment — conflicting with Unassigned → empty.
  if (assignment === "unassigned" && (assessment === "assessed" || assessment === "unassessed")) {
    return [];
  }

  return list.filter((app) => {
    if (!matchAssignApplicantSearch(app, search)) return false;

    const assignState = classifyAssignAssignmentState(app);
    if (assignment !== "all" && assignState !== assignment) return false;

    if (assessment !== "all") {
      const assessState = classifyAssignAssessmentState(app);
      if (assessState !== assessment) return false;
    }

    if (stage !== "all") {
      if (classifyDirectorApplicationStage(app?.status) !== stage) return false;
    }

    return true;
  });
}

/**
 * Counts for filter chips over the full assignable population (not search-narrowed).
 *
 * Assessment counts only consider applicants with an active assignment.
 *
 * @param {Array<object>} applications
 * @returns {{
 *   assignment: { all: number, assigned: number, unassigned: number },
 *   assessment: { all: number, assessed: number, unassessed: number },
 *   stage: { all: number, stage_1: number, stage_2: number },
 * }}
 */
export function summarizeAssignApplicantFilterCounts(applications) {
  const list = Array.isArray(applications) ? applications : [];
  const assignment = { all: list.length, assigned: 0, unassigned: 0 };
  const assessment = { all: 0, assessed: 0, unassessed: 0 };
  const stage = { all: list.length, stage_1: 0, stage_2: 0 };

  for (const app of list) {
    const assignState = classifyAssignAssignmentState(app);
    if (assignState === "assigned") assignment.assigned += 1;
    else assignment.unassigned += 1;

    const assessState = classifyAssignAssessmentState(app);
    if (assessState === "assessed") {
      assessment.all += 1;
      assessment.assessed += 1;
    } else if (assessState === "unassessed") {
      assessment.all += 1;
      assessment.unassessed += 1;
    }

    const st = classifyDirectorApplicationStage(app?.status);
    if (st === "stage_1") stage.stage_1 += 1;
    else if (st === "stage_2") stage.stage_2 += 1;
  }

  return { assignment, assessment, stage };
}
