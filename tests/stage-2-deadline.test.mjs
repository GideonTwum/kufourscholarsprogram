import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateApplicationsOpenGate,
  APPLICATION_DEADLINE_PASSED_MESSAGE,
} from "../lib/applications-open-gate.js";
import { isDeadlineExpired, parseDeadlineRaw, formatDeadlineGmt } from "../lib/deadline-gate.js";
import {
  DEFAULT_STAGE_2_DEADLINE_ISO,
  STAGE_2_DEADLINE_PASSED_MESSAGE,
  STAGE_2_DEADLINE_NOT_CONFIGURED_MESSAGE,
  STAGE_2_SUBMIT_ELIGIBLE_STATUS,
  evaluateStage2DeadlineGate,
  stage2DeadlineAbsoluteCopy,
} from "../lib/stage-2-deadline-gate.js";
import {
  COMMUNICATION_AUDIENCES,
  filterClassifiedByAudience,
} from "../lib/director-communications.js";
import { assertStatusTransition } from "../lib/application-status-transition.mjs";

const FUTURE = "2099-01-01T12:00:00.000Z";
const PAST = "2000-01-01T12:00:00.000Z";
const EXACT = "2026-10-11T23:59:00.000Z";

test("Stage 2 default ISO matches intended production deadline", () => {
  assert.equal(DEFAULT_STAGE_2_DEADLINE_ISO, "2026-10-11T23:59:00.000Z");
  assert.match(
    formatDeadlineGmt(DEFAULT_STAGE_2_DEADLINE_ISO),
    /^11 October 2026 at 11:59\s*(am|pm|AM|PM) GMT$/i
  );
  assert.match(stage2DeadlineAbsoluteCopy(DEFAULT_STAGE_2_DEADLINE_ISO), /11 October 2026/);
});

test("boundary rule: nowMs > deadlineMs closes; exact deadline still open", () => {
  const { deadlineMs } = parseDeadlineRaw(EXACT);
  assert.equal(isDeadlineExpired(deadlineMs, deadlineMs), false);
  assert.equal(isDeadlineExpired(deadlineMs, deadlineMs + 1), true);

  const atExact = evaluateStage2DeadlineGate({ deadlineRaw: EXACT, nowMs: deadlineMs });
  assert.equal(atExact.allowed, true);
  assert.equal(atExact.isExpired, false);

  const after = evaluateStage2DeadlineGate({ deadlineRaw: EXACT, nowMs: deadlineMs + 1 });
  assert.equal(after.allowed, false);
  assert.equal(after.reason, STAGE_2_DEADLINE_PASSED_MESSAGE);
});

test("Stage 2 submission allowed before deadline and rejected after", () => {
  const before = evaluateStage2DeadlineGate({ deadlineRaw: FUTURE, nowMs: Date.now() });
  assert.equal(before.allowed, true);

  const after = evaluateStage2DeadlineGate({ deadlineRaw: PAST, nowMs: Date.now() });
  assert.equal(after.allowed, false);
  assert.equal(after.reason, STAGE_2_DEADLINE_PASSED_MESSAGE);
});

test("missing/invalid Stage 2 deadline fails closed", () => {
  assert.equal(evaluateStage2DeadlineGate({ deadlineRaw: "" }).allowed, false);
  assert.equal(
    evaluateStage2DeadlineGate({ deadlineRaw: "" }).reason,
    STAGE_2_DEADLINE_NOT_CONFIGURED_MESSAGE
  );
  assert.equal(evaluateStage2DeadlineGate({ deadlineRaw: "not-a-date" }).allowed, false);
  assert.equal(evaluateStage2DeadlineGate({ deadlineRaw: null }).allowed, false);
});

test("Stage 1 deadline remains independent and unaffected by Stage 2 helpers", () => {
  const stage1 = evaluateApplicationsOpenGate({
    applicationsOpen: "true",
    deadlineRaw: FUTURE,
  });
  assert.equal(stage1.allowed, true);

  const stage1Past = evaluateApplicationsOpenGate({
    applicationsOpen: "true",
    deadlineRaw: PAST,
  });
  assert.equal(stage1Past.allowed, false);
  assert.equal(stage1Past.reason, APPLICATION_DEADLINE_PASSED_MESSAGE);

  // Stage 1 still allows empty deadline when open (unchanged precedent)
  const stage1Empty = evaluateApplicationsOpenGate({
    applicationsOpen: "true",
    deadlineRaw: "",
  });
  assert.equal(stage1Empty.allowed, true);

  // Stage 2 empty fails closed (different, intentional)
  assert.equal(evaluateStage2DeadlineGate({ deadlineRaw: "" }).allowed, false);
});

test("only stage_1_approved may submit Stage 2", () => {
  assert.equal(STAGE_2_SUBMIT_ELIGIBLE_STATUS, "stage_1_approved");
  assert.equal(assertStatusTransition("stage_1_approved", "stage_2_submitted"), null);
  assert.ok(assertStatusTransition("stage_1_submitted", "stage_2_submitted"));
  assert.ok(assertStatusTransition("stage_2_submitted", "stage_2_submitted"));
  assert.ok(assertStatusTransition("accepted", "stage_2_submitted"));
  assert.ok(assertStatusTransition("draft", "stage_2_submitted"));
});

test("deadline extension: past → future re-opens gate without status changes", () => {
  const closed = evaluateStage2DeadlineGate({ deadlineRaw: PAST, nowMs: Date.parse(EXACT) });
  assert.equal(closed.allowed, false);
  const extended = evaluateStage2DeadlineGate({
    deadlineRaw: "2026-10-13T23:59:00.000Z",
    nowMs: Date.parse(EXACT),
  });
  assert.equal(extended.allowed, true);
});

test("migration seeds stage_2_deadline without touching Stage 1 keys", () => {
  const mig = resolve("supabase/migrations/202610040001_stage_2_deadline.sql");
  assert.equal(existsSync(mig), true);
  const sql = readFileSync(mig, "utf8");
  assert.match(sql, /stage_2_deadline/);
  assert.match(sql, /2026-10-11T23:59:00\.000Z/);
  assert.match(sql, /ON CONFLICT \(key\) DO NOTHING/);
  assert.doesNotMatch(sql, /UPDATE\s+public\.site_settings[\s\S]*application_deadline/i);
  assert.doesNotMatch(sql, /UPDATE public\.applications/i);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/i);
});

test("submit-stage2 enforces Stage 2 deadline server-side with force-dynamic", () => {
  const src = readFileSync(resolve("app/api/applications/submit-stage2/route.js"), "utf8");
  assert.match(src, /export const dynamic = "force-dynamic"/);
  assert.match(src, /evaluateStage2DeadlineGate/);
  assert.match(src, /STAGE_2_DEADLINE_SETTING_KEY/);
  assert.match(src, /createAdminClient/);
  assert.match(src, /\[stage2-deadline-diagnostic\]/);
  assert.match(src, /status: 403/);
  assert.doesNotMatch(src, /application_deadline/);
  assert.doesNotMatch(src, /applications_open/);
});

test("Director settings allowlist includes stage_2_deadline", () => {
  const src = readFileSync(resolve("app/api/director/settings/route.js"), "utf8");
  assert.match(src, /stage_2_deadline/);
  assert.match(src, /requireActiveDirector/);
  const ui = readFileSync(resolve("app/(dashboard)/director/settings/page.js"), "utf8");
  assert.match(ui, /Stage 2 Deadline/);
  assert.match(ui, /Approved Stage 1 applicants must complete and submit Stage 2/);
  assert.match(ui, /Stage 1 Application Deadline/);
});

test("applicant Stage 2 countdown wiring and eligibility-only display", () => {
  const stage2 = readFileSync(resolve("app/(applicant)/applicant/stage2/page.js"), "utf8");
  assert.match(stage2, /Stage2DeadlineCard/);
  assert.match(stage2, /STAGE_2_DEADLINE_SETTING_KEY/);
  assert.match(stage2, /evaluateStage2DeadlineGate/);
  assert.match(stage2, /Stage 2 submissions are closed/);

  const dash = readFileSync(resolve("app/(applicant)/applicant/page.js"), "utf8");
  assert.match(dash, /Stage2DeadlineCard/);
  assert.match(dash, /stage_1_approved/);
  assert.match(dash, /STAGE_2_DEADLINE_SETTING_KEY/);
});

test("communications audience stage_1_approved targets only awaiting Stage 2", () => {
  assert.ok(COMMUNICATION_AUDIENCES.includes("stage_1_approved"));
  const classified = [
    { app: { id: "1", status: "stage_1_approved" }, workflow: "unassigned" },
    { app: { id: "2", status: "stage_1_submitted" }, workflow: "assessed" },
    { app: { id: "3", status: "stage_2_submitted" }, workflow: "assigned" },
    { app: { id: "4", status: "accepted" }, workflow: null },
  ];
  const rows = filterClassifiedByAudience(classified, "stage_1_approved");
  assert.deepEqual(
    rows.map((r) => r.app.id),
    ["1"]
  );
});

test("shared DeadlineCountdown used by Hero; no service-role in applicant Stage 2 UI", () => {
  const hero = readFileSync(resolve("components/landing/Hero.jsx"), "utf8");
  assert.match(hero, /DeadlineCountdown/);
  const stage2 = readFileSync(resolve("app/(applicant)/applicant/stage2/page.js"), "utf8");
  assert.doesNotMatch(stage2, /SERVICE_ROLE|service_role|createAdminClient/);
  const card = readFileSync(resolve("components/applicant/Stage2DeadlineCard.jsx"), "utf8");
  assert.doesNotMatch(card, /SERVICE_ROLE|service_role/);
});
