/**
 * Shared staff account lifecycle (panel + assessor).
 * Server-only helpers — use with Admin client after director auth.
 */

export function isProfileActive(profile) {
  if (!profile) return false;
  return profile.is_active !== false;
}

/**
 * @returns {null|string} blocking reason or null if safe to delete
 */
export function deletionBlockReason({ evaluationCount = 0, hasAssignments = false }) {
  if (evaluationCount > 0) {
    return "This panel member has interview evaluation history and cannot be permanently deleted. Deactivate the account instead.";
  }
  if (hasAssignments) {
    return "This panel member has assignment history and cannot be permanently deleted. Deactivate the account instead.";
  }
  return null;
}

/**
 * Permanent delete for assessors — blocked when any assignment or assessment history exists.
 * @returns {null|string}
 */
export function assessorDeletionBlockReason({
  assessmentCount = 0,
  assignmentCount = 0,
} = {}) {
  if (assessmentCount > 0 || assignmentCount > 0) {
    return "This assessor has assignment or assessment history and cannot be permanently deleted. Deactivate the account instead.";
  }
  return null;
}

export function deactivateProfilePayload(directorId) {
  return {
    is_active: false,
    deactivated_at: new Date().toISOString(),
    deactivated_by: directorId,
  };
}

export function reactivateProfilePayload() {
  return {
    is_active: true,
    deactivated_at: null,
    deactivated_by: null,
  };
}

/** Ban duration for Supabase Auth admin updateUserById */
export const AUTH_BAN_LONG = "876000h"; // ~100 years
export const AUTH_BAN_NONE = "none";

export function evaluatorDisplayName(evaluation, profile) {
  return (
    evaluation?.evaluator_name_snapshot ||
    profile?.full_name ||
    evaluation?.evaluator_email_snapshot ||
    profile?.email ||
    "Panel Member"
  );
}
