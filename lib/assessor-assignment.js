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
