import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DIRECTOR_PENDING_STATUSES } from "../lib/director-application-scope.js";
import { DIRECTOR_AUDIT_ACTIONS } from "../lib/audit/director-audit.js";
import { canTransitionStatus } from "../lib/application-status-transition.mjs";
import {
  APPLICATION_RESTORE_ACTION,
  DIRECTOR_RESTORE_TARGET_STATUSES,
  buildRejectedRestorePatch,
  hasDirectorRestoreInterviewConflict,
  inferRestoreTargetFromEvidence,
  mapPriorStatusToRestoreTarget,
  previousStatusFromAuditEvents,
  resolveRejectedRestoreTarget,
  validateRestoreConfirmation,
} from "../lib/director-application-restore.js";

const routeSource = readFileSync(
  resolve("app/api/director/applications/[id]/restore/route.js"),
  "utf8"
);
const pageSource = readFileSync(
  resolve("app/(dashboard)/director/applications/[id]/page.js"),
  "utf8"
);
const dialogSource = readFileSync(
  resolve("components/director/DirectorRestoreRejectedApplication.jsx"),
  "utf8"
);
const updateStatusSource = readFileSync(
  resolve("app/api/applications/[id]/update-status/route.js"),
  "utf8"
);

function rejectedApp(overrides = {}) {
  return {
    id: "app-restore-1",
    status: "rejected",
    full_name: "Ama Boateng",
    rejection_reason: "Incomplete documents",
    stage_1_submitted_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

test("successful restoration targets Stage 1 pending review from submission evidence", () => {
  const app = rejectedApp();
  const resolved = resolveRejectedRestoreTarget(app);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.status, "stage_1_submitted");
  assert.equal(DIRECTOR_PENDING_STATUSES.includes(resolved.status), true);

  const patch = buildRejectedRestorePatch(app, resolved.status, { reason: "Documents now complete" });
  assert.equal(patch.ok, true);
  assert.equal(patch.patch.status, "stage_1_submitted");
  assert.equal(patch.patch.rejection_reason, null);
  assert.equal(patch.oldValue.status, "rejected");
  assert.equal(patch.oldValue.rejection_reason, "Incomplete documents");
  assert.equal(patch.metadata.mutates_assessments, false);
  assert.equal(patch.metadata.mutates_interview_assignments, false);
  assert.equal(patch.metadata.sends_notifications, false);
  assert.equal(patch.metadata.appears_in_pending_filter, true);
});

test("Stage 2 rejected restores to stage_2_submitted pending review", () => {
  const app = rejectedApp({
    stage_2_submitted_at: "2026-10-01T00:00:00.000Z",
    video_youtube_url: "https://youtu.be/example",
    stage_2_approved_at: null,
  });
  const resolved = resolveRejectedRestoreTarget(app);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.status, "stage_2_submitted");
});

test("Stage 2 approved then rejected restores to stage_2_approved without shortlisting", () => {
  const app = rejectedApp({
    stage_2_submitted_at: "2026-10-01T00:00:00.000Z",
    stage_2_approved_at: "2026-10-05T00:00:00.000Z",
  });
  const resolved = resolveRejectedRestoreTarget(app, {
    previousStatus: "interview_review_pending",
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.status, "stage_2_approved");
  assert.notEqual(resolved.status, "interview_review_pending");
  assert.notEqual(resolved.status, "called_for_interview");
});

test("audit previous status is preferred for pending-review classification", () => {
  assert.deepEqual(mapPriorStatusToRestoreTarget("review_pending", rejectedApp()), {
    ok: true,
    status: "review_pending",
    source: "audit",
  });
  const fromEvents = previousStatusFromAuditEvents([
    {
      action: "application.status_changed",
      old_value: { status: "stage_2_review_pending" },
      new_value: { status: "rejected" },
    },
  ]);
  assert.equal(fromEvents, "stage_2_review_pending");
  const resolved = resolveRejectedRestoreTarget(
    rejectedApp({ stage_2_submitted_at: "2026-10-01T00:00:00.000Z" }),
    { previousStatus: fromEvents }
  );
  assert.equal(resolved.status, "stage_2_review_pending");
});

test("non-rejected applications cannot be restored", () => {
  const resolved = resolveRejectedRestoreTarget({
    id: "app-2",
    status: "stage_1_submitted",
  });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.code, "not_rejected");
  assert.equal(resolved.statusCode, 409);
});

test("duplicate restore is blocked once status is no longer rejected", () => {
  const patch = buildRejectedRestorePatch(
    { id: "app-3", status: "stage_1_submitted" },
    "stage_1_submitted"
  );
  assert.equal(patch.ok, false);
  assert.equal(patch.statusCode, 409);
  assert.match(routeSource, /\.eq\("status", "rejected"\)/);
  assert.match(routeSource, /already_restored/);
});

test("interview assignment or published slot blocks restoration", () => {
  assert.equal(
    hasDirectorRestoreInterviewConflict(rejectedApp({ interview_slot_id: "slot-1" })),
    true
  );
  assert.equal(
    hasDirectorRestoreInterviewConflict(rejectedApp(), { interview_slot_id: "slot-2" }),
    true
  );
  const blocked = resolveRejectedRestoreTarget(rejectedApp({ interview_slot_id: "slot-1" }));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "interview_conflict");
});

test("ambiguous evidence fails safely instead of guessing", () => {
  const inferred = inferRestoreTargetFromEvidence({ id: "app-4", status: "rejected" });
  assert.equal(inferred.ok, false);
  assert.equal(inferred.code, "ambiguous");
  const resolved = resolveRejectedRestoreTarget({ id: "app-4", status: "rejected" });
  assert.equal(resolved.ok, false);
});

test("restore confirmation is required and general status API still blocks rejected exits", () => {
  assert.equal(validateRestoreConfirmation({}).ok, false);
  assert.equal(validateRestoreConfirmation({ confirm: true }).ok, true);
  assert.equal(canTransitionStatus("rejected", "stage_1_submitted"), false);
  assert.equal(canTransitionStatus("rejected", "stage_2_submitted"), false);
  assert.match(routeSource, /requireActiveDirector\(\)/);
  assert.match(routeSource, /validateRestoreConfirmation\(body\)/);
  assert.match(dialogSource, /confirm: true/);
  assert.doesNotMatch(routeSource, /sendKspEmail/);
  assert.doesNotMatch(routeSource, /\.from\("notifications"\)/);
  assert.match(routeSource, /sends_notifications: false/);
  assert.doesNotMatch(routeSource, /interview_slot_id:/);
  assert.doesNotMatch(routeSource, /\.from\("application_assessments"\)/);
  assert.doesNotMatch(updateStatusSource, /restored_to_pending_review/);
});

test("audit logging records restore action and preserves assessment records by design", () => {
  assert.ok(DIRECTOR_AUDIT_ACTIONS.includes(APPLICATION_RESTORE_ACTION));
  assert.match(routeSource, /APPLICATION_RESTORE_ACTION|application\.restored_to_pending_review/);
  assert.match(routeSource, /recordDirectorAudit/);
  assert.match(routeSource, /restore_reason|metadata/);
  for (const status of DIRECTOR_RESTORE_TARGET_STATUSES) {
    assert.equal(DIRECTOR_PENDING_STATUSES.includes(status), true);
  }
});

test("unauthorized callers are rejected by the restore route gate", () => {
  const handler = routeSource.slice(routeSource.indexOf("export async function POST"));
  const authGate = handler.indexOf("requireActiveDirector()");
  const update = handler.indexOf('.from("applications")');
  assert.ok(authGate >= 0);
  assert.ok(update > authGate);
  assert.match(handler, /if \(gate\.error\) return gate\.error/);
});

test("director profile shows restore only for rejected applications", () => {
  assert.match(pageSource, /DirectorRestoreRejectedApplication/);
  assert.match(dialogSource, /Restore to Pending Review/);
  assert.match(dialogSource, /guarantee progression to the interview stage/i);
  assert.match(dialogSource, /confirm: true/);
  assert.match(dialogSource, /Administrative reason \(optional\)/);
  assert.match(dialogSource, /status !== "rejected"/);
});
