/**
 * Controlled restoration of rejected applications to pending review.
 *
 * Does not shortlist, assign interview batches, or send notifications.
 * Fails safely when the pending-review target cannot be determined.
 */

import { hasStage2SubmissionEvidence } from "./director-stage2-review.js";
import { DIRECTOR_PENDING_STATUSES } from "./director-application-scope.js";

export const APPLICATION_RESTORE_ACTION = "application.restored_to_pending_review";

/** Statuses a restore may land on (pending-review / operational, never invitation). */
export const DIRECTOR_RESTORE_TARGET_STATUSES = Object.freeze([
  "stage_1_submitted",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
]);

const INTERVIEW_PIPELINE_STATUSES = Object.freeze([
  "interview_review_pending",
  "called_for_interview",
  "interview",
]);

export const DIRECTOR_RESTORE_SELECT =
  "id, status, full_name, rejection_reason, director_notes, submitted_at, stage_1_submitted_at, stage_1_approved_at, stage_2_submitted_at, stage_2_approved_at, interview_shortlisted_at, interview_slot_id, interview_date, interview_time, interview_location, video_youtube_url, updated_at";

function textOrBlank(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * True when restoring would conflict with an active interview assignment or invitation.
 */
export function hasDirectorRestoreInterviewConflict(application, allocation = null) {
  if (application?.interview_slot_id) return true;
  if (allocation?.interview_slot_id) return true;
  return false;
}

/**
 * Map a prior status (usually from audit) onto a safe restore target.
 * Interview/shortlist statuses never restore directly — they collapse to stage_2_approved
 * when Stage 2 approval evidence exists, otherwise fail.
 */
export function mapPriorStatusToRestoreTarget(previousStatus, application = {}) {
  const previous = textOrBlank(previousStatus);
  if (!previous) return { ok: false, code: "missing_previous_status" };

  if (DIRECTOR_RESTORE_TARGET_STATUSES.includes(previous)) {
    return { ok: true, status: previous, source: "audit" };
  }

  if (INTERVIEW_PIPELINE_STATUSES.includes(previous)) {
    if (application.stage_2_approved_at) {
      return { ok: true, status: "stage_2_approved", source: "safe_from_interview_pipeline" };
    }
    return {
      ok: false,
      code: "ambiguous_interview_restore",
      error:
        "This applicant was rejected during interview processing, and a safe pending-review status could not be determined.",
    };
  }

  if (previous === "pending") {
    return { ok: true, status: "stage_1_submitted", source: "legacy_pending" };
  }

  return {
    ok: false,
    code: "unsupported_previous_status",
    error: `Cannot restore from previous status "${previous}" to a pending-review state.`,
  };
}

/**
 * Infer restore target from submission / approval evidence only.
 * Prefer explicit audit previous status when available.
 */
export function inferRestoreTargetFromEvidence(application = {}) {
  if (application.stage_2_approved_at) {
    return { ok: true, status: "stage_2_approved", source: "stage_2_approved_at" };
  }
  if (hasStage2SubmissionEvidence(application)) {
    return { ok: true, status: "stage_2_submitted", source: "stage_2_submission_evidence" };
  }
  if (application.stage_1_approved_at) {
    return { ok: true, status: "stage_1_approved", source: "stage_1_approved_at" };
  }
  if (application.stage_1_submitted_at || application.submitted_at) {
    return { ok: true, status: "stage_1_submitted", source: "stage_1_submission_evidence" };
  }
  return {
    ok: false,
    code: "ambiguous",
    error: "Could not determine the appropriate pending-review status for this application.",
  };
}

/**
 * Resolve the restore target for a rejected application.
 * @returns {{
 *   ok: boolean,
 *   status?: string,
 *   source?: string,
 *   code?: string,
 *   error?: string,
 *   statusCode?: number
 * }}
 */
export function resolveRejectedRestoreTarget(application, { previousStatus = null, allocation = null } = {}) {
  if (!application?.id) {
    return { ok: false, code: "not_found", error: "Application not found.", statusCode: 404 };
  }
  if (application.status !== "rejected") {
    return {
      ok: false,
      code: "not_rejected",
      error: "Only rejected applications can be restored to pending review.",
      statusCode: 409,
    };
  }
  if (hasDirectorRestoreInterviewConflict(application, allocation)) {
    return {
      ok: false,
      code: "interview_conflict",
      error:
        "This application has an interview batch assignment or published invitation. Remove or resolve that assignment before restoring.",
      statusCode: 409,
    };
  }

  if (previousStatus) {
    const mapped = mapPriorStatusToRestoreTarget(previousStatus, application);
    if (mapped.ok) return mapped;
    if (mapped.code === "ambiguous_interview_restore" || mapped.code === "unsupported_previous_status") {
      return { ...mapped, statusCode: 409 };
    }
  }

  const inferred = inferRestoreTargetFromEvidence(application);
  if (!inferred.ok) {
    return { ...inferred, statusCode: 409 };
  }
  return inferred;
}

/**
 * Build the applications patch for a restore. Does not touch assessments, documents, or personal fields.
 */
export function buildRejectedRestorePatch(application, targetStatus, { reason = "", now = new Date() } = {}) {
  // Caller must already have validated; this is a final allowlist check.
  if (!DIRECTOR_RESTORE_TARGET_STATUSES.includes(targetStatus)) {
    return { ok: false, error: "Invalid restore target status.", statusCode: 400 };
  }
  if (application?.status !== "rejected") {
    return {
      ok: false,
      error: "Only rejected applications can be restored to pending review.",
      statusCode: 409,
    };
  }

  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString();
  const reasonText = textOrBlank(reason).slice(0, 1000);

  return {
    ok: true,
    patch: {
      status: targetStatus,
      updated_at: nowIso,
      // Clear active rejection marker so the profile is not still labelled rejected.
      // Historical reason is retained in the audit event.
      rejection_reason: null,
    },
    oldValue: {
      status: "rejected",
      rejection_reason: application.rejection_reason || null,
    },
    newValue: {
      status: targetStatus,
    },
    metadata: {
      restore_reason: reasonText || null,
      previous_rejection_reason: application.rejection_reason || null,
      mutates_assessments: false,
      mutates_interview_assignments: false,
      sends_notifications: false,
      appears_in_pending_filter: DIRECTOR_PENDING_STATUSES.includes(targetStatus),
    },
  };
}

/**
 * Extract previous status from director audit rows for this application.
 * Looks for the most recent status change into rejected.
 */
export function previousStatusFromAuditEvents(events = []) {
  for (const event of events || []) {
    const action = textOrBlank(event?.action);
    if (action && action !== "application.status_changed" && action !== APPLICATION_RESTORE_ACTION) {
      continue;
    }
    const nextStatus = textOrBlank(event?.new_value?.status);
    const previous = textOrBlank(event?.old_value?.status);
    if (nextStatus === "rejected" && previous && previous !== "rejected") {
      return previous;
    }
  }
  return null;
}

export function validateRestoreConfirmation(body) {
  if (body?.confirm !== true) {
    return { ok: false, error: "Confirmation is required to restore this application.", statusCode: 400 };
  }
  if (body?.reason != null && typeof body.reason !== "string") {
    return { ok: false, error: "Restoration reason must be text.", statusCode: 400 };
  }
  if (typeof body?.reason === "string" && body.reason.length > 1000) {
    return { ok: false, error: "Restoration reason must be at most 1000 characters.", statusCode: 400 };
  }
  return { ok: true };
}
