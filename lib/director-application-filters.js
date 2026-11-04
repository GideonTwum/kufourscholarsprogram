/**
 * Director Applications filter composition helpers.
 *
 * Filters AND together. Some combinations are mutually exclusive
 * (e.g. Application Stage=Interview ∩ Status=Rejected) and produce an empty
 * list even when stage chip counts still show the full population.
 *
 * Chip navigations should call mergeDirectorApplicationFilters so selecting a
 * stage/status/workflow clears only incompatible partners — valid combinations
 * are preserved.
 */

import { DIRECTOR_APPLICATION_STAGE_LABELS } from "./director-application-scope.js";
import {
  DIRECTOR_TERMINAL_STATUSES,
  DIRECTOR_WORKFLOW_LABELS,
} from "./director-application-workflow.js";
import { DIRECTOR_STAGE2_REVIEW_LABELS } from "./director-stage2-review.js";

export const DIRECTOR_APPLICATIONS_CLEAR_ALL_HREF = "/director/applications";

const TERMINAL_STATUS_SET = new Set(DIRECTOR_TERMINAL_STATUSES);

export function isTerminalDirectorStatusFilter(status) {
  return TERMINAL_STATUS_SET.has(status);
}

export function isSpecificDirectorStageFilter(stage) {
  return Boolean(stage) && stage !== "all";
}

export function isSpecificDirectorWorkflowFilter(workflow) {
  return Boolean(workflow) && workflow !== "all";
}

/**
 * Normalize a filters object to the canonical Applications list shape.
 */
export function normalizeDirectorApplicationFilters(filters = {}) {
  return {
    status: typeof filters.status === "string" ? filters.status : "",
    workflow:
      typeof filters.workflow === "string" && filters.workflow
        ? filters.workflow
        : "all",
    stage: typeof filters.stage === "string" && filters.stage ? filters.stage : "all",
    stage2: typeof filters.stage2 === "string" ? filters.stage2 : "",
    assessor: typeof filters.assessor === "string" ? filters.assessor : "",
    region: typeof filters.region === "string" ? filters.region : "",
    town: typeof filters.town === "string" ? filters.town : "",
    alloc: typeof filters.alloc === "string" ? filters.alloc : "",
    idate: typeof filters.idate === "string" ? filters.idate : "",
    q: typeof filters.q === "string" ? filters.q : "",
  };
}

/**
 * Whether Stage and Status can both match any application.
 * Terminal statuses are Status-only and never have an Application Stage.
 */
export function directorStageStatusCompatible(stage, status) {
  if (!isSpecificDirectorStageFilter(stage)) return true;
  if (!status) return true;
  if (status === "pending") return true;
  return !isTerminalDirectorStatusFilter(status);
}

/**
 * Whether Workflow and Status can both match.
 * Terminal statuses are excluded from actionable workflow queues.
 */
export function directorWorkflowStatusCompatible(workflow, status) {
  if (!isSpecificDirectorWorkflowFilter(workflow)) return true;
  if (!status) return true;
  if (status === "pending") return true;
  return !isTerminalDirectorStatusFilter(status);
}

/**
 * Whether Stage and Workflow can both match.
 * Interview / Panel statuses are exactly the Interview stage set.
 */
export function directorStageWorkflowCompatible(stage, workflow) {
  if (!isSpecificDirectorStageFilter(stage) || !isSpecificDirectorWorkflowFilter(workflow)) {
    return true;
  }
  if (workflow === "interview_panel") return stage === "interview";
  if (stage === "interview") {
    // Interview statuses always classify as interview_panel, never unassigned/assigned/assessed.
    return workflow === "interview_panel";
  }
  return true;
}

/**
 * Merge a chip/patch onto the current filter state, clearing only incompatible
 * partners so users are not left with empty unintended combinations.
 *
 * @param {object} current
 * @param {object} patch — only keys being changed by the click
 */
export function mergeDirectorApplicationFilters(current = {}, patch = {}) {
  const next = normalizeDirectorApplicationFilters({ ...current, ...patch });

  if (Object.prototype.hasOwnProperty.call(patch, "stage")) {
    if (isSpecificDirectorStageFilter(next.stage) && isTerminalDirectorStatusFilter(next.status)) {
      next.status = "";
    }
    if (!directorStageWorkflowCompatible(next.stage, next.workflow)) {
      next.workflow = "all";
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "status")) {
    if (isTerminalDirectorStatusFilter(next.status)) {
      next.stage = "all";
      if (isSpecificDirectorWorkflowFilter(next.workflow)) next.workflow = "all";
    } else if (!directorStageStatusCompatible(next.stage, next.status)) {
      next.stage = "all";
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "workflow")) {
    if (
      isSpecificDirectorWorkflowFilter(next.workflow) &&
      isTerminalDirectorStatusFilter(next.status)
    ) {
      next.status = "";
    }
    if (!directorStageWorkflowCompatible(next.stage, next.workflow)) {
      // Keep the newly selected workflow; align stage so the combination can match.
      next.stage = next.workflow === "interview_panel" ? "interview" : "all";
    }
  }

  return next;
}

/**
 * True when any non-default list filter is active (including search).
 */
export function hasActiveDirectorApplicationFilters(filters = {}) {
  const f = normalizeDirectorApplicationFilters(filters);
  return Boolean(
    f.status ||
      (f.workflow && f.workflow !== "all") ||
      (f.stage && f.stage !== "all") ||
      f.stage2 ||
      f.assessor ||
      f.region ||
      f.town ||
      f.alloc ||
      f.idate ||
      (typeof f.q === "string" && f.q.trim())
  );
}

/**
 * Human-readable active filter chips for the Applications page banner.
 * @returns {Array<{ key: string, label: string, value: string }>}
 */
export function describeActiveDirectorApplicationFilters(filters = {}, extras = {}) {
  const f = normalizeDirectorApplicationFilters(filters);
  const out = [];
  if (f.stage && f.stage !== "all") {
    out.push({
      key: "stage",
      label: "Application Stage",
      value: DIRECTOR_APPLICATION_STAGE_LABELS[f.stage] || f.stage,
    });
  }
  if (f.stage2) {
    const stage2Label =
      f.stage2 === "all"
        ? "All Stage 2"
        : DIRECTOR_STAGE2_REVIEW_LABELS?.[f.stage2] || f.stage2;
    out.push({ key: "stage2", label: "Stage 2 Review", value: stage2Label });
  }
  if (f.workflow && f.workflow !== "all") {
    out.push({
      key: "workflow",
      label: "Assessment Workflow",
      value: DIRECTOR_WORKFLOW_LABELS[f.workflow] || f.workflow,
    });
  }
  if (f.status) {
    const statusLabel =
      f.status === "pending"
        ? "Pending"
        : f.status === "accepted"
          ? "Accepted"
          : f.status === "rejected"
            ? "Rejected"
            : f.status.replace(/_/g, " ");
    out.push({ key: "status", label: "Status", value: statusLabel });
  }
  if (f.assessor) {
    out.push({
      key: "assessor",
      label: "Assessor",
      value: extras.assessorName || "Selected assessor",
    });
  }
  if (typeof f.q === "string" && f.q.trim()) {
    out.push({ key: "q", label: "Search", value: f.q.trim() });
  }
  return out;
}

/**
 * Detect known mutually exclusive filter pairs for empty-state messaging.
 */
export function findDirectorApplicationFilterConflicts(filters = {}) {
  const f = normalizeDirectorApplicationFilters(filters);
  const conflicts = [];
  if (!directorStageStatusCompatible(f.stage, f.status)) {
    conflicts.push({
      keys: ["stage", "status"],
      message: `Application Stage “${DIRECTOR_APPLICATION_STAGE_LABELS[f.stage] || f.stage}” cannot combine with Status “${f.status}”. Rejected and Accepted applications are Status-only and are not part of Stage 1, Stage 2, or Interview.`,
    });
  }
  if (!directorWorkflowStatusCompatible(f.workflow, f.status)) {
    conflicts.push({
      keys: ["workflow", "status"],
      message: `Assessment Workflow “${DIRECTOR_WORKFLOW_LABELS[f.workflow] || f.workflow}” cannot combine with Status “${f.status}”. Terminal outcomes are excluded from workflow queues.`,
    });
  }
  if (!directorStageWorkflowCompatible(f.stage, f.workflow)) {
    conflicts.push({
      keys: ["stage", "workflow"],
      message: `Application Stage “${DIRECTOR_APPLICATION_STAGE_LABELS[f.stage] || f.stage}” cannot combine with Assessment Workflow “${DIRECTOR_WORKFLOW_LABELS[f.workflow] || f.workflow}”.`,
    });
  }
  if (f.workflow === "unassigned" && f.assessor) {
    conflicts.push({
      keys: ["workflow", "assessor"],
      message:
        "Unassigned cannot combine with a selected Assessor (an application cannot be both).",
    });
  }
  return conflicts;
}

/**
 * Empty-state copy for the Applications table.
 */
export function directorApplicationsEmptyMessage(filters = {}, { hasSearch = false } = {}) {
  const f = normalizeDirectorApplicationFilters(filters);
  if (hasSearch || (typeof f.q === "string" && f.q.trim())) {
    return "No applications match your search in this filtered view.";
  }
  const conflicts = findDirectorApplicationFilterConflicts(f);
  if (conflicts.length) {
    return `${conflicts[0].message} Clear or change the conflicting filters to see matching applications. Stage chip counts show the full population and are not narrowed by Status or Workflow.`;
  }
  if (f.assessor) return "No applications currently assigned to this assessor in this view.";
  if (f.stage === "stage_1") return "No Stage 1 applications match the selected filters.";
  if (f.stage === "stage_2") return "No Stage 2 applications match the selected filters.";
  if (f.stage === "interview") return "No Interview-stage applications match the selected filters.";
  if (f.stage2 === "all") return "No Stage 2 applicants match the selected filters.";
  if (f.stage2 === "approved") return "No Stage 2 approved applications match the selected filters.";
  if (f.stage2 === "pending") return "No Stage 2 applications pending review match the selected filters.";
  if (f.stage2 === "rejected") return "No Stage 2 rejected applications match the selected filters.";
  if (f.workflow === "unassigned") return "No unassigned applications match the selected filters.";
  if (f.workflow === "assigned") return "No applications awaiting assessor review match the selected filters.";
  if (f.workflow === "assessed") return "No assessed applications awaiting Director action match the selected filters.";
  if (f.workflow === "interview_panel") return "No interview / panel applications match the selected filters.";
  if (f.status === "pending") return "No pending applications match the selected filters.";
  if (f.status === "accepted") return "No accepted applications match the selected filters.";
  if (f.status === "rejected") return "No rejected applications match the selected filters.";
  if (hasActiveDirectorApplicationFilters(f)) {
    return "No applications match the selected filters.";
  }
  return "No applications found.";
}
