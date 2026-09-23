/**
 * Director application assessor/interview workflow queues.
 *
 * Orthogonal to applications.status (official progress) and to the existing
 * All / Pending / Accepted / Rejected status chips.
 *
 * Classification uses existing sources of truth only:
 * - applications.status (draft excluded via operational scope)
 * - assessor_assignments.status === "active"
 * - application_assessments presence for the active assignee + current stage
 * - interview/panel statuses already used by dashboard metrics
 *
 * Queues are mutually exclusive CURRENT stages (priority order below).
 *
 * Terminal outcomes (accepted / rejected) remain in All Submitted and Status
 * filters, but are excluded from actionable workflow queues so they are not
 * misleadingly labeled Unassigned/Assigned/Assessed.
 */

import { assessmentStageForStatus } from "./assessor-workflow.js";

/**
 * Final recruitment outcomes — STATUS_TRANSITIONS leaves these with no outgoing edges.
 * Do not invent additional terminals beyond this canonical pair.
 */
export const DIRECTOR_TERMINAL_STATUSES = ["accepted", "rejected"];

/** Matches dashboard-metrics "interviews" rollup (shortlisted → scheduled → complete). */
export const DIRECTOR_INTERVIEW_PANEL_STATUSES = [
  "interview_review_pending",
  "called_for_interview",
  "interview",
];

export const DIRECTOR_WORKFLOW_FILTERS = [
  { key: "all", label: "All Submitted" },
  { key: "unassigned", label: "Unassigned" },
  { key: "assigned", label: "Assigned" },
  { key: "assessed", label: "Assessed" },
  { key: "interview_panel", label: "Interview / Panel" },
];

export const DIRECTOR_WORKFLOW_LABELS = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  assessed: "Assessed",
  interview_panel: "Interview / Panel",
};

/**
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
export function isDirectorTerminalStatus(status) {
  return DIRECTOR_TERMINAL_STATUSES.includes(status);
}

/**
 * @param {string|null|undefined} status
 * @returns {boolean}
 */
export function isDirectorInterviewPanelStatus(status) {
  return DIRECTOR_INTERVIEW_PANEL_STATUSES.includes(status);
}

/**
 * Whether the active assignee has completed the assessment required for the
 * application's current assessor stage (stage_1 vs stage_2).
 *
 * @param {string|null|undefined} applicationStatus
 * @param {{ assessor_id?: string|null }|null|undefined} activeAssignment
 * @param {Array<{ application_id?: string, assessor_id?: string, stage?: string }>|null|undefined} assessments
 * @param {string} applicationId
 */
export function hasCompletedAssessorAssessmentForCurrentStage(
  applicationStatus,
  activeAssignment,
  assessments,
  applicationId
) {
  if (!activeAssignment?.assessor_id || !applicationId) return false;
  const stage = assessmentStageForStatus(applicationStatus);
  const list = Array.isArray(assessments) ? assessments : [];
  return list.some(
    (row) =>
      row &&
      row.application_id === applicationId &&
      row.assessor_id === activeAssignment.assessor_id &&
      row.stage === stage
  );
}

/**
 * Classify one operational application into a mutually exclusive workflow queue.
 *
 * Priority:
 * 1. draft → null (not operational)
 * 2. terminal (accepted / rejected) → null (not an actionable queue; still in All Submitted)
 * 3. interview_panel — official interview/panel statuses
 * 4. assessed — active assignment + completed assessment for current stage
 * 5. assigned — active assignment, assessment still pending
 * 6. unassigned — non-terminal, no active assignment
 *
 * @param {{
 *   status?: string|null,
 *   id?: string,
 *   hasActiveAssignment?: boolean,
 *   hasCompletedAssessmentForAssignee?: boolean,
 * }} input
 * @returns {"unassigned"|"assigned"|"assessed"|"interview_panel"|null}
 */
export function classifyDirectorWorkflowStage(input) {
  const status = input?.status || null;
  if (!status || status === "draft") return null;

  // Final outcomes belong in All Submitted + Status filters, not work queues.
  if (isDirectorTerminalStatus(status)) return null;

  if (isDirectorInterviewPanelStatus(status)) {
    return "interview_panel";
  }

  const hasActive = Boolean(input?.hasActiveAssignment);
  const assessed = Boolean(input?.hasCompletedAssessmentForAssignee);

  if (hasActive && assessed) return "assessed";
  if (hasActive) return "assigned";
  return "unassigned";
}

/**
 * Count All Submitted vs actionable workflow queues.
 *
 * `all` includes every classified operational row (including terminals with
 * workflow === null). Queue buckets only count non-null workflow stages, so
 * All Submitted may exceed Unassigned+Assigned+Assessed+Interview/Panel.
 *
 * @param {Array<{ workflow?: string|null }>} classifiedRows
 * @returns {{ all: number, unassigned: number, assigned: number, assessed: number, interview_panel: number }}
 */
export function summarizeDirectorWorkflowCounts(classifiedRows) {
  const counts = {
    all: 0,
    unassigned: 0,
    assigned: 0,
    assessed: 0,
    interview_panel: 0,
  };
  for (const row of classifiedRows || []) {
    // Caller passes operational rows only (drafts already excluded).
    counts.all += 1;
    const wf = row?.workflow;
    if (wf && wf in counts && wf !== "all") counts[wf] += 1;
  }
  return counts;
}

/**
 * Filter classified rows by workflow key. "all" / empty → no restriction.
 * @param {Array<{ workflow?: string|null }>} rows
 * @param {string} workflowFilter
 */
export function filterByDirectorWorkflow(rows, workflowFilter) {
  const list = Array.isArray(rows) ? rows : [];
  const key = typeof workflowFilter === "string" ? workflowFilter.trim() : "";
  if (!key || key === "all") return list;
  return list.filter((row) => row.workflow === key);
}

/**
 * Normalize search + match against list display fields already available to Directors.
 * @param {object} app
 * @param {string} query
 */
export function directorApplicationMatchesSearch(app, query) {
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (!q) return true;
  const hay = [
    app?.profiles?.full_name,
    app?.full_name,
    app?.profiles?.email,
    app?.email,
    app?.university,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Build assignment/assessment lookup used by classification + list labels.
 *
 * @param {Array<{ application_id: string, assessor_id: string, status?: string, profiles?: { full_name?: string, email?: string } }>} activeAssignments
 * @param {Array<{ application_id: string, assessor_id: string, stage?: string, recommendation?: string, submitted_at?: string, assessor_name_snapshot?: string }>} assessments
 * @param {Map<string, string>|Record<string, string>} [statusByAppId] optional status map for stage-aware assessment
 */
export function buildDirectorAssignmentWorkflowMap(activeAssignments, assessments, statusByAppId = {}) {
  const map = {};
  for (const row of activeAssignments || []) {
    if (!row?.application_id) continue;
    // Callers should pass active rows; ignore closed assignments defensively.
    if (row.status && row.status !== "active") continue;

    const name = row.profiles?.full_name || row.profiles?.email || "Assessor";
    map[row.application_id] = {
      assessor_id: row.assessor_id,
      label: `Assigned to ${name}`,
      email: row.profiles?.email || null,
      hasAssessment: false,
      recommendation: null,
    };
  }

  const statusMap =
    statusByAppId instanceof Map
      ? statusByAppId
      : new Map(Object.entries(statusByAppId || {}));

  // Prefer newest assessment rows first when callers ordered by submitted_at desc
  for (const a of assessments || []) {
    const entry = map[a.application_id];
    if (!entry || entry.hasAssessment) continue;
    if (a.assessor_id !== entry.assessor_id) continue;

    const appStatus = statusMap.get(a.application_id);
    if (appStatus) {
      const requiredStage = assessmentStageForStatus(appStatus);
      if (a.stage && a.stage !== requiredStage) continue;
    }

    entry.hasAssessment = true;
    entry.recommendation = a.recommendation || null;
    const who = a.assessor_name_snapshot || entry.label.replace(/^Assigned to /, "");
    entry.label = `Assessment submitted by ${who}`;
  }

  return map;
}

/**
 * Classify a list of operational applications given an assignment workflow map.
 * @param {Array<{ id: string, status?: string }>} applications
 * @param {Record<string, { assessor_id?: string, hasAssessment?: boolean, label?: string }>} assignmentMap
 */
export function classifyDirectorApplications(applications, assignmentMap = {}) {
  return (applications || []).map((app) => {
    const meta = assignmentMap[app.id] || null;
    const workflow = classifyDirectorWorkflowStage({
      status: app.status,
      id: app.id,
      hasActiveAssignment: Boolean(meta),
      hasCompletedAssessmentForAssignee: Boolean(meta?.hasAssessment),
    });
    return {
      app,
      workflow,
      assignment: meta,
      workflowLabel: workflow ? DIRECTOR_WORKFLOW_LABELS[workflow] : null,
    };
  });
}
