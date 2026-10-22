/**
 * Stage 2 review tracking for Director Applications and dashboard counts.
 *
 * Source of truth is applications.status (not video upload alone):
 * - submitted: status === stage_2_submitted
 * - pending:   stage_2_submitted | stage_2_review_pending (awaiting Director decision)
 * - approved:  status === stage_2_approved (Director approved Stage 2)
 * - rejected:  status === rejected after a Stage 2 submission, without Stage 2 approval
 *
 * Interview / accepted / later rejection stay outside these queues.
 */

import { DIRECTOR_APPLICATION_STAGE_2_STATUSES } from "./director-application-scope.js";

export const DIRECTOR_STAGE2_PENDING_STATUSES = Object.freeze([
  "stage_2_submitted",
  "stage_2_review_pending",
]);

export const DIRECTOR_STAGE2_REVIEW_FILTERS = Object.freeze([
  { key: "all", label: "All Stage 2 Applicants" },
  { key: "approved", label: "Stage 2 Approved" },
  { key: "pending", label: "Stage 2 Pending Review" },
  { key: "rejected", label: "Stage 2 Rejected" },
]);

export const DIRECTOR_STAGE2_REVIEW_LABELS = Object.freeze({
  all: "All Stage 2 Applicants",
  approved: "Stage 2 Approved",
  pending: "Stage 2 Pending Review",
  rejected: "Stage 2 Rejected",
  submitted: "Stage 2 Submitted",
  not_submitted: "Stage 2 Not Submitted",
});

/**
 * @param {string|null|undefined} raw
 * @returns {"all"|"approved"|"pending"|"rejected"|""}
 */
export function normalizeDirectorStage2ReviewParam(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) return "";
  if (DIRECTOR_STAGE2_REVIEW_FILTERS.some((f) => f.key === key)) return key;
  return "";
}

/**
 * @param {{ status?: string, stage_2_submitted_at?: string|null, video_youtube_url?: string|null, stage_2_approved_at?: string|null }} app
 */
export function hasStage2SubmissionEvidence(app) {
  if (!app) return false;
  if (DIRECTOR_APPLICATION_STAGE_2_STATUSES.includes(app.status)) return true;
  if (app.stage_2_submitted_at) return true;
  if (typeof app.video_youtube_url === "string" && app.video_youtube_url.trim()) return true;
  return false;
}

/**
 * Rejected during Stage 2 review (submitted Stage 2, Director never approved).
 * Later interview/final rejections keep stage_2_approved_at and are excluded.
 */
export function isStage2Rejected(app) {
  if (!app || app.status !== "rejected") return false;
  if (app.stage_2_approved_at) return false;
  return hasStage2SubmissionEvidence(app);
}

/**
 * @param {{ status?: string, stage_2_submitted_at?: string|null, video_youtube_url?: string|null, stage_2_approved_at?: string|null }} app
 * @returns {"all"|"submitted"|"pending"|"approved"|"rejected"|"not_submitted"|null}
 */
export function classifyDirectorStage2Review(app) {
  const status = app?.status;
  if (!status || status === "draft") return null;
  if (status === "stage_2_approved") return "approved";
  if (DIRECTOR_STAGE2_PENDING_STATUSES.includes(status)) return "pending";
  if (isStage2Rejected(app)) return "rejected";
  if (hasStage2SubmissionEvidence(app)) return null;
  if (status === "stage_1_approved") return "not_submitted";
  return null;
}

export function isDirectorStage2PipelineStatus(status) {
  return DIRECTOR_APPLICATION_STAGE_2_STATUSES.includes(status);
}

/**
 * @param {Array<object>} rows classified `{ app }` or raw applications
 * @param {string} stage2Filter
 */
export function filterByDirectorStage2Review(rows, stage2Filter) {
  const list = Array.isArray(rows) ? rows : [];
  const key = normalizeDirectorStage2ReviewParam(stage2Filter);
  if (!key) return list;
  return list.filter((row) => {
    const app = row?.app ?? row;
    if (key === "all") return isDirectorStage2PipelineStatus(app?.status);
    if (key === "approved") return app?.status === "stage_2_approved";
    if (key === "pending") return DIRECTOR_STAGE2_PENDING_STATUSES.includes(app?.status);
    if (key === "rejected") return isStage2Rejected(app);
    return false;
  });
}

/**
 * Mutually exclusive current-status buckets for dashboard cards.
 * `pending` includes submitted + deferred so it matches the Pending Review filter.
 *
 * @param {Array<object>} rows
 * @returns {{ all: number, submitted: number, pending: number, approved: number, rejected: number }}
 */
export function summarizeDirectorStage2ReviewCounts(rows) {
  const counts = { all: 0, submitted: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of rows || []) {
    const app = row?.app ?? row;
    const status = app?.status;
    if (status === "stage_2_submitted") {
      counts.submitted += 1;
      counts.pending += 1;
      counts.all += 1;
      continue;
    }
    if (status === "stage_2_review_pending") {
      counts.pending += 1;
      counts.all += 1;
      continue;
    }
    if (status === "stage_2_approved") {
      counts.approved += 1;
      counts.all += 1;
      continue;
    }
    if (isStage2Rejected(app)) {
      counts.rejected += 1;
    }
  }
  return counts;
}

/**
 * Count Stage 2 rejections without loading application rows.
 * @param {{ from: (table: string) => any }} client
 */
export async function fetchDirectorStage2RejectedCount(client) {
  const submittedAt = await client
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "rejected")
    .is("stage_2_approved_at", null)
    .not("stage_2_submitted_at", "is", null);
  if (!submittedAt.error) return submittedAt.count || 0;

  const video = await client
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "rejected")
    .is("stage_2_approved_at", null)
    .not("video_youtube_url", "is", null);
  return video.error ? 0 : video.count || 0;
}

export const DIRECTOR_STAGE2_REVIEW_BADGE = Object.freeze({
  approved: {
    label: "Stage 2 Approved",
    color: "bg-green-50 text-green-700",
  },
  pending: {
    label: "Stage 2 Pending Review",
    color: "bg-amber-50 text-amber-700",
  },
  rejected: {
    label: "Stage 2 Rejected",
    color: "bg-red-50 text-red-700",
  },
  not_submitted: {
    label: "Stage 2 Not Submitted",
    color: "bg-gray-100 text-gray-600",
  },
});
