import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getDirectorStageActions,
  showsScheduleInterviewCta,
  showsShortlistForInterviewCta,
  showsFinalProgrammeAccept,
  showsAmbiguousAcceptLabel,
  isInterviewSchedulingStage,
  isInterviewQueueStatus,
} from "../lib/director-stage-actions.js";
import {
  assertStatusTransition,
  canTransitionStatus,
} from "../lib/application-status-transition.mjs";

test("stage_2_approved shows Shortlist for Interview, not Schedule/Accept", () => {
  const config = getDirectorStageActions("stage_2_approved");
  assert.ok(isInterviewSchedulingStage("stage_2_approved"));
  assert.ok(showsShortlistForInterviewCta(config));
  assert.equal(showsScheduleInterviewCta(config), false);
  assert.equal(showsFinalProgrammeAccept(config), false);
  assert.equal(showsAmbiguousAcceptLabel(config), false);
  assert.ok(config.actions.some((a) => a.label === "Keep Pending" && a.type === "noop"));
  assert.ok(config.actions.some((a) => a.label === "Reject Application"));
  assert.match(config.helperText || "", /interview queue/i);
});

test("shortlist transitions to interview_review_pending without accepting", () => {
  const config = getDirectorStageActions("stage_2_approved");
  const primary = config.actions.find((a) => a.variant === "primary");
  assert.equal(primary.type, "status");
  assert.equal(primary.next, "interview_review_pending");
  assert.equal(assertStatusTransition("stage_2_approved", "interview_review_pending"), null);
  assert.equal(canTransitionStatus("stage_2_approved", "accepted"), false);
});

test("interview queue status shows Go to Interview Scheduling, not schedule modal", () => {
  assert.ok(isInterviewQueueStatus("interview_review_pending"));
  const config = getDirectorStageActions("interview_review_pending");
  assert.ok(config.actions.some((a) => a.type === "href" && a.href === "/director/interviews"));
  assert.equal(showsScheduleInterviewCta(config), false);
  assert.equal(showsFinalProgrammeAccept(config), false);
  assert.ok(config.actions.some((a) => /Remove from Interview Queue/i.test(a.label)));
});

test("called_for_interview cannot final-accept; interview status can", () => {
  assert.match(
    assertStatusTransition("called_for_interview", "accepted"),
    /Invalid status transition/
  );
  assert.equal(canTransitionStatus("called_for_interview", "accepted"), false);
  assert.equal(assertStatusTransition("called_for_interview", "interview"), null);
  assert.equal(assertStatusTransition("interview", "accepted"), null);
});

test("scheduled interview CTAs do not open one-off schedule as primary", () => {
  const config = getDirectorStageActions("called_for_interview", { hasInterviewDetails: true });
  assert.equal(showsScheduleInterviewCta(config), false);
  assert.equal(showsFinalProgrammeAccept(config), false);
  assert.ok(config.actions.some((a) => a.label === "Mark Interview Complete"));
  assert.ok(config.actions.some((a) => a.label === "View Interview"));
});

test("final programme accept only on interview status", () => {
  const config = getDirectorStageActions("interview");
  assert.ok(showsFinalProgrammeAccept(config));
  assert.equal(showsAmbiguousAcceptLabel(config), false);
  assert.ok(config.actions.some((a) => a.label === "Accept into Programme"));
});

test("update-status shortlists without schedule email event", () => {
  const src = readFileSync(
    resolve("app/api/applications/[id]/update-status/route.js"),
    "utf8"
  );
  assert.match(src, /application\.shortlisted_for_interview/);
  assert.match(src, /interview_shortlisted_at/);
  assert.match(src, /Shortlisted for interview/);
  assert.match(src, /isShortlist/);
});

test("interview batch API prefers shortlisted queue and completes apps", () => {
  const post = readFileSync(resolve("app/api/interview-slots/route.js"), "utf8");
  assert.match(post, /not_shortlisted_use_shortlist_first/);
  assert.match(post, /allow_unshortlisted/);
  assert.match(post, /interview_batch_assigned/);

  const patch = readFileSync(
    resolve("app/api/director/interview-slots/[id]/route.js"),
    "utf8"
  );
  assert.match(patch, /interview\.batch_completed/);
  assert.match(patch, /applicants_advanced/);
  assert.match(patch, /interview_review_pending/);

  const get = readFileSync(resolve("app/api/director/interview-slots/route.js"), "utf8");
  assert.match(get, /unscheduled/);
  assert.match(get, /ready_to_shortlist/);
});

test("migration and interviews page support queue workflow", () => {
  assert.ok(
    existsSync(resolve("supabase/migrations/202608050001_interview_queue_batch_workflow.sql"))
  );
  const page = readFileSync(
    resolve("app/(dashboard)/director/interviews/page.js"),
    "utf8"
  );
  assert.match(page, /Unscheduled Interview Candidates/);
  assert.match(page, /Schedule Selected Candidates/);
  assert.match(page, /allow_unshortlisted/);
  const detail = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(detail, /Applicant added to the interview queue/);
  assert.match(detail, /Go to Interview Scheduling/);
});
