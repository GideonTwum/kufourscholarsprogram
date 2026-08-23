/**
 * Canonical Director operational application scope.
 *
 * Product definition:
 * - Operational applications = rows Directors review in /director/applications
 * - Drafts are incomplete Stage 1 work and are NOT part of operational totals/lists
 * - Scope is NOT limited by application_class_name (historical Classes remain visible)
 *
 * Dashboard "Total applications" and Applications "All (N)" MUST use this same base set.
 */

import { VALID_APPLICATION_STATUSES } from "./application-status-transition.mjs";

/** Incomplete Stage 1 rows — excluded from Director operational lists/counts. */
export const DIRECTOR_EXCLUDED_STATUSES = ["draft"];

/**
 * In-progress (not accepted / rejected / draft).
 * Includes legacy "pending" if present in older data.
 */
export const DIRECTOR_PENDING_STATUSES = [
  "stage_1_submitted",
  "pending",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
  "interview_review_pending",
  "called_for_interview",
  "interview",
];

export const DIRECTOR_PRIMARY_FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

/** Apply operational base scope (exclude drafts) to a Supabase query builder. */
export function applyDirectorOperationalScope(query) {
  return query.neq("status", "draft");
}

/**
 * Apply list filter on top of operational scope.
 * @param {object} query Supabase query
 * @param {string} statusFilter "" | "pending" | "accepted" | "rejected" | exact status
 */
export function applyDirectorStatusFilter(query, statusFilter) {
  if (!statusFilter) return query;
  if (statusFilter === "pending") {
    return query.in("status", DIRECTOR_PENDING_STATUSES);
  }
  if (statusFilter === "accepted" || statusFilter === "rejected") {
    return query.eq("status", statusFilter);
  }
  // Dashboard deep-links (e.g. stage_1_submitted) — exact match, never drafts
  if (
    VALID_APPLICATION_STATUSES.includes(statusFilter) &&
    !DIRECTOR_EXCLUDED_STATUSES.includes(statusFilter)
  ) {
    return query.eq("status", statusFilter);
  }
  return query;
}

/**
 * @param {{ status?: string }[]} rows
 * @returns {{ all: number, pending: number, accepted: number, rejected: number, draft: number, total_including_drafts: number }}
 */
export function summarizeDirectorApplicationCounts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const draft = list.filter((r) => r.status === "draft").length;
  const operational = list.filter((r) => r.status !== "draft");
  return {
    all: operational.length,
    pending: operational.filter((r) => DIRECTOR_PENDING_STATUSES.includes(r.status)).length,
    accepted: operational.filter((r) => r.status === "accepted").length,
    rejected: operational.filter((r) => r.status === "rejected").length,
    draft,
    total_including_drafts: list.length,
  };
}

export function isDirectorOperationalStatus(status) {
  return Boolean(status) && status !== "draft";
}
