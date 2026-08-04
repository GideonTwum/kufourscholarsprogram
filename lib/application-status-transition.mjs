/**
 * Canonical application statuses and enforced from→to transitions (launch).
 */

export const VALID_APPLICATION_STATUSES = [
  "draft",
  "stage_1_submitted",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
  "called_for_interview",
  "interview",
  "interview_review_pending",
  "accepted",
  "rejected",
];

/** Statuses the director update-status API may set (excludes draft). */
export const DIRECTOR_SETTABLE_STATUSES = VALID_APPLICATION_STATUSES.filter((s) => s !== "draft");

/**
 * Allowed transitions. Keys = current status; values = allowed next statuses.
 * Terminal: accepted, rejected (no outgoing).
 */
export const STATUS_TRANSITIONS = {
  draft: ["stage_1_submitted", "rejected"],
  stage_1_submitted: ["review_pending", "stage_1_approved", "rejected"],
  review_pending: ["stage_1_submitted", "stage_1_approved", "rejected"],
  stage_1_approved: ["stage_2_submitted", "review_pending", "rejected"],
  stage_2_submitted: [
    "stage_2_review_pending",
    "stage_2_approved",
    "interview_review_pending",
    "rejected",
  ],
  stage_2_review_pending: [
    "stage_2_submitted",
    "stage_2_approved",
    "interview_review_pending",
    "rejected",
  ],
  stage_2_approved: [
    "called_for_interview",
    "interview",
    "interview_review_pending",
    "rejected",
  ],
  interview_review_pending: [
    "stage_2_approved",
    "called_for_interview",
    "interview",
    "rejected",
  ],
  called_for_interview: [
    "interview",
    "interview_review_pending",
    "accepted",
    "rejected",
  ],
  interview: ["interview_review_pending", "accepted", "rejected", "called_for_interview"],
  accepted: [],
  rejected: [],
};

/** Normalize legacy aliases to launch statuses before transition checks. */
export function normalizeApplicationStatus(status) {
  const map = {
    pending: "stage_1_submitted",
    stage1_submitted: "stage_1_submitted",
    under_review: "review_pending",
    shortlisted_for_stage2: "stage_1_approved",
    stage2_submitted: "stage_2_submitted",
  };
  if (!status) return status;
  return map[status] || status;
}

export function canTransitionStatus(fromStatus, toStatus) {
  const from = normalizeApplicationStatus(fromStatus);
  const to = normalizeApplicationStatus(toStatus);
  if (!VALID_APPLICATION_STATUSES.includes(to)) return false;
  if (from === to) return false;
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * @returns {string|null} error message or null if ok
 */
export function assertStatusTransition(fromStatus, toStatus) {
  const from = normalizeApplicationStatus(fromStatus);
  const to = normalizeApplicationStatus(toStatus);

  if (!VALID_APPLICATION_STATUSES.includes(to)) {
    return `Invalid status: ${toStatus}`;
  }

  if (from === "accepted" || from === "rejected") {
    return `Cannot change status after application is ${from}`;
  }

  if (!canTransitionStatus(from, to)) {
    return `Invalid status transition from "${from}" to "${to}"`;
  }

  return null;
}

/**
 * Validates director/API body shape (status + interview/class fields).
 * Does not check from→to (call assertStatusTransition separately).
 */
export function validateStatusUpdateInput(body) {
  const status = body?.status;

  if (!DIRECTOR_SETTABLE_STATUSES.includes(status) && !VALID_APPLICATION_STATUSES.includes(status)) {
    return "Invalid status";
  }

  if (status === "draft") {
    return "Directors cannot set status to draft";
  }

  if (status === "accepted" && !body?.class_name?.trim?.()) {
    return "class_name is required when accepting an applicant";
  }

  if (status === "called_for_interview") {
    const interview = body?.interview;
    if (
      !interview?.interview_date ||
      !interview?.interview_time?.trim?.() ||
      !interview?.interview_location?.trim?.()
    ) {
      return "Interview date, time, and location (or meeting link) are required.";
    }
  }

  return null;
}

/**
 * Safe internal path for auth redirects (no open redirect).
 * @returns {string} path starting with /
 */
export function safeAuthRedirectPath(next, fallback = "/applicant") {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return fallback;
  if (trimmed.toLowerCase().includes("javascript:")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  return trimmed;
}
