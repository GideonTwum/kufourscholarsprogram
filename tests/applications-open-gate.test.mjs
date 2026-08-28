import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APPLICATION_DEADLINE_PASSED_MESSAGE,
  APPLICATIONS_CLOSED_MESSAGE,
  evaluateApplicationsOpenGate,
  supabaseProjectHostFromUrl,
} from "../lib/applications-open-gate.js";

const NOW = Date.parse("2026-08-28T19:00:00.000Z");
const FUTURE = "2026-09-27T23:59:00.000Z";
const PAST = "2026-08-01T23:59:00.000Z";

test("production-like settings allow Stage 1 submit on 2026-08-28", () => {
  const gate = evaluateApplicationsOpenGate({
    applicationsOpen: "true",
    deadlineRaw: FUTURE,
    nowMs: NOW,
  });
  assert.equal(gate.allowed, true);
  assert.equal(gate.reason, null);
  assert.equal(gate.isExpired, false);
});

test("deadline before now blocks with exact message", () => {
  const gate = evaluateApplicationsOpenGate({
    applicationsOpen: "true",
    deadlineRaw: PAST,
    nowMs: NOW,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, APPLICATION_DEADLINE_PASSED_MESSAGE);
  assert.equal(gate.isExpired, true);
});

test("applications_open false blocks even with future deadline", () => {
  const gate = evaluateApplicationsOpenGate({
    applicationsOpen: "false",
    deadlineRaw: FUTURE,
    nowMs: NOW,
  });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, APPLICATIONS_CLOSED_MESSAGE);
});

test("empty deadline allows when open", () => {
  const gate = evaluateApplicationsOpenGate({
    applicationsOpen: "true",
    deadlineRaw: "",
    nowMs: NOW,
  });
  assert.equal(gate.allowed, true);
  assert.equal(gate.reason, null);
});

test("missing open setting does not auto-close (only explicit non-true closes)", () => {
  const gate = evaluateApplicationsOpenGate({
    applicationsOpen: null,
    deadlineRaw: FUTURE,
    nowMs: NOW,
  });
  assert.equal(gate.allowed, true);
});

test("supabaseProjectHostFromUrl extracts host only", () => {
  assert.equal(
    supabaseProjectHostFromUrl("https://dgiglwchavvjlhwqafbj.supabase.co"),
    "dgiglwchavvjlhwqafbj.supabase.co"
  );
});

test("submit-stage1 uses admin client + deadline diagnostic + force-dynamic", () => {
  const src = readFileSync(resolve("app/api/applications/submit-stage1/route.js"), "utf8");
  assert.match(src, /createAdminClient/);
  assert.match(src, /evaluateApplicationsOpenGate/);
  assert.match(src, /\[stage1-deadline-diagnostic\]/);
  assert.match(src, /force-dynamic/);
  assert.doesNotMatch(src, /return "The application deadline has passed\."/);
});

test("deadline message has a single executable source module", () => {
  const gate = readFileSync(resolve("lib/applications-open-gate.js"), "utf8");
  assert.match(gate, /APPLICATION_DEADLINE_PASSED_MESSAGE/);
  assert.match(gate, /The application deadline has passed\./);
});
