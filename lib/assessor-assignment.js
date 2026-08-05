/**
 * Shared Director ↔ Assessor assignment rules.
 * Official application status is never changed by assignment.
 */

export const ASSESSOR_ASSIGNABLE_STATUSES = [
  "stage_1_submitted",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function isAssessorAssignableStatus(status) {
  return ASSESSOR_ASSIGNABLE_STATUSES.includes(status);
}

/**
 * Normalize POST body to a unique list of application ids.
 * Accepts application_id (string) and/or application_ids (array).
 */
export function normalizeAssignmentApplicationIds(body) {
  const ids = [];
  if (typeof body?.application_id === "string" && body.application_id.trim()) {
    ids.push(body.application_id.trim());
  }
  if (Array.isArray(body?.application_ids)) {
    for (const id of body.application_ids) {
      if (typeof id === "string" && id.trim()) ids.push(id.trim());
    }
  }
  return [...new Set(ids)];
}

export function resolveReassignAssessorId(body) {
  if (typeof body?.new_assessor_id === "string" && body.new_assessor_id.trim()) {
    return body.new_assessor_id.trim();
  }
  if (typeof body?.assessor_id === "string" && body.assessor_id.trim()) {
    return body.assessor_id.trim();
  }
  return null;
}

/**
 * Classify an applicant card relative to the assessor selected in the Assign UI.
 * Source of truth: active assessor_assignments only (via current_assignment).
 *
 * @returns {"assigned_to_selected"|"assigned_to_other"|"unassigned"}
 */
export function classifyAssignmentCardState(currentAssignment, selectedAssessorId) {
  const assessorId = currentAssignment?.assessor?.id || currentAssignment?.assessor_id || null;
  if (!assessorId) return "unassigned";
  if (selectedAssessorId && assessorId === selectedAssessorId) return "assigned_to_selected";
  return "assigned_to_other";
}

export function assessorDisplayName(assessor) {
  if (!assessor) return "Unknown assessor";
  return assessor.full_name || assessor.email || "Unknown assessor";
}

/**
 * Build the nested current_assignment payload used by Director UIs.
 */
export function buildCurrentAssignmentPayload(assignmentRow, assessorProfile, assessmentRow) {
  if (!assignmentRow || assignmentRow.status !== "active") return null;
  const assessor =
    assessorProfile ||
    (assignmentRow.assessor_id
      ? {
          id: assignmentRow.assessor_id,
          full_name: null,
          email: null,
        }
      : null);

  return {
    id: assignmentRow.id,
    status: assignmentRow.status,
    assigned_at: assignmentRow.assigned_at || null,
    assessor: assessor
      ? {
          id: assessor.id,
          full_name: assessor.full_name || null,
          email: assessor.email || null,
        }
      : null,
    assessment: assessmentRow
      ? {
          status: "submitted",
          recommendation: assessmentRow.recommendation || null,
          submitted_at: assessmentRow.submitted_at || null,
        }
      : {
          status: "pending",
          recommendation: null,
          submitted_at: null,
        },
  };
}

/**
 * Filter bulk-assign selection:
 * - skip apps already assigned to the target assessor (no duplicate)
 * - return ids that need assign or reassign
 */
export function filterAssignableSelection(applicationIds, applicationsById, selectedAssessorId) {
  const toProcess = [];
  const alreadyAssigned = [];
  const toReassign = [];
  const toAssignNew = [];

  for (const id of applicationIds) {
    const app = applicationsById[id];
    const state = classifyAssignmentCardState(app?.current_assignment, selectedAssessorId);
    if (state === "assigned_to_selected") {
      alreadyAssigned.push(id);
      continue;
    }
    toProcess.push(id);
    if (state === "assigned_to_other") toReassign.push(id);
    else toAssignNew.push(id);
  }

  return { toProcess, alreadyAssigned, toReassign, toAssignNew };
}

export function formatAssignedDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
