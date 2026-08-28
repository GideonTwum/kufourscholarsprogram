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

/**
 * Exact status counts via PostgREST head+count (avoids silent 1000-row truncation).
 * @param {{ from: (table: string) => any }} client Supabase client (admin preferred)
 * @returns {Promise<{ byStatus: Record<string, number>, summary: ReturnType<typeof summarizeDirectorApplicationCounts> }>}
 */
export async function fetchDirectorApplicationCountSummary(client) {
  const emptyCounts = Object.fromEntries(VALID_APPLICATION_STATUSES.map((k) => [k, 0]));
  const statuses = [...VALID_APPLICATION_STATUSES];

  const results = await Promise.all(
    statuses.map((status) =>
      client
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
        .then(({ count, error }) => ({ status, count: error ? 0 : count || 0 }))
    )
  );

  const byStatus = { ...emptyCounts };
  for (const row of results) {
    byStatus[row.status] = row.count;
  }

  // Synthetic row list for existing summarizer (one placeholder per counted row is wasteful;
  // compute summary directly from counts).
  const draft = byStatus.draft || 0;
  let pending = 0;
  let accepted = byStatus.accepted || 0;
  let rejected = byStatus.rejected || 0;
  let all = 0;
  let total_including_drafts = 0;

  for (const status of statuses) {
    const n = byStatus[status] || 0;
    total_including_drafts += n;
    if (status === "draft") continue;
    all += n;
    if (DIRECTOR_PENDING_STATUSES.includes(status)) pending += n;
  }

  // Include legacy "pending" if present outside VALID list (older DBs)
  const { count: legacyPending } = await client
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (legacyPending && !statuses.includes("pending")) {
    pending += legacyPending;
    all += legacyPending;
    total_including_drafts += legacyPending;
    byStatus.pending = legacyPending;
  }

  return {
    byStatus,
    summary: {
      all,
      pending,
      accepted,
      rejected,
      draft,
      total_including_drafts,
    },
  };
}

/**
 * Page through application rows to avoid PostgREST default max-rows truncation.
 * @param {() => any} buildQuery factory returning a fresh filterable query (before range)
 * @param {{ pageSize?: number, maxRows?: number }} [opts]
 */
export async function fetchAllApplicationPages(buildQuery, opts = {}) {
  const pageSize = opts.pageSize || 1000;
  const maxRows = opts.maxRows || 10000;
  const rows = [];
  let from = 0;

  while (from < maxRows) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) {
      return { data: rows, error };
    }
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}
