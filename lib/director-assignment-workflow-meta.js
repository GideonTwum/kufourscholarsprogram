/**
 * Shared Director loader for active assignments + assessments used by
 * workflow classification (Applications page, Communications audiences, etc.).
 *
 * Critical: assessments must NOT be loaded with a single giant
 * `.in("application_id", allActiveAppIds)` — PostgREST/URL limits silently
 * fail and leave every assignee looking "unassessed".
 */

import {
  fetchAllApplicationPages,
  fetchAllRowsForIds,
} from "./director-application-scope.js";
import { buildDirectorAssignmentWorkflowMap } from "./director-application-workflow.js";

export const DIRECTOR_ASSIGNMENT_WORKFLOW_SELECT =
  "application_id, assessor_id, status, profiles:assessor_id(full_name, email, is_active)";

export const DIRECTOR_ASSESSMENT_WORKFLOW_SELECT =
  "application_id, assessor_id, stage, recommendation, submitted_at, assessor_name_snapshot";

/**
 * @param {object} admin Supabase admin client
 * @param {Array<{ id: string, status?: string }>|null|undefined} applications operational apps
 * @param {{ logLabel?: string }} [opts]
 * @returns {Promise<Record<string, object>>}
 */
export async function loadDirectorAssignmentWorkflowMeta(admin, applications, opts = {}) {
  const logLabel = opts.logLabel || "director-assignment-workflow-meta";

  const { data: activeRows, error: assignErr } = await fetchAllApplicationPages(() =>
    admin
      .from("assessor_assignments")
      .select(DIRECTOR_ASSIGNMENT_WORKFLOW_SELECT)
      .eq("status", "active")
  );

  if (assignErr) {
    console.error(`[${logLabel}] load active assignments failed`, {
      code: assignErr.code || null,
      message: assignErr.message || String(assignErr),
      operation: "assessor_assignments.select",
    });
  }

  const active = activeRows || [];
  const appIds = active.map((r) => r.application_id).filter(Boolean);

  let assessments = [];
  if (appIds.length > 0) {
    const { data: assessmentRows, error: assessErr } = await fetchAllRowsForIds(
      (chunkIds) =>
        admin
          .from("application_assessments")
          .select(DIRECTOR_ASSESSMENT_WORKFLOW_SELECT)
          .in("application_id", chunkIds)
          .order("submitted_at", { ascending: false }),
      appIds
    );

    if (assessErr) {
      console.error(`[${logLabel}] load assessments failed`, {
        code: assessErr.code || null,
        message: assessErr.message || String(assessErr),
        operation: "application_assessments.select.chunked",
        activeAssignmentCount: active.length,
        applicationIdCount: appIds.length,
      });
    } else {
      assessments = assessmentRows || [];
      if (active.length > 0 && assessments.length === 0) {
        console.warn(`[${logLabel}] assessments empty while active assignments exist`, {
          activeAssignmentCount: active.length,
          applicationIdCount: appIds.length,
        });
      }
    }
  }

  const statusByAppId = Object.fromEntries(
    (applications || []).map((app) => [app.id, app.status])
  );
  return buildDirectorAssignmentWorkflowMap(active, assessments, statusByAppId);
}
