import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertLoginPortalRole,
  loginPathForProtectedRoute,
  loginPathForRole,
  isValidStaffCreateRole,
} from "../lib/portal-auth.js";
import { generateTemporaryPassword } from "../lib/staff-credentials.js";

test("wrong-role login messages point to correct portals", () => {
  const a = assertLoginPortalRole("assessor", "director");
  assert.equal(a.ok, false);
  assert.match(a.message, /Assessor Portal/i);

  const p = assertLoginPortalRole("panel", "assessor");
  assert.equal(p.ok, false);
  assert.match(p.message, /Panel Portal/i);

  const app = assertLoginPortalRole("applicant", "panel");
  assert.equal(app.ok, false);

  assert.equal(assertLoginPortalRole("applicant", "applicant").ok, true);
  assert.equal(assertLoginPortalRole("scholar", "applicant").ok, true);
  assert.equal(assertLoginPortalRole("director", "director").ok, true);
  assert.equal(assertLoginPortalRole("assessor", "assessor").ok, true);
  assert.equal(assertLoginPortalRole("panel", "panel").ok, true);
});

test("protected routes map to dedicated login pages", () => {
  assert.equal(loginPathForProtectedRoute("/applicant/application"), "/login");
  assert.equal(loginPathForProtectedRoute("/assessor"), "/assessor-login");
  assert.equal(loginPathForProtectedRoute("/assessor/xyz"), "/assessor-login");
  assert.equal(loginPathForProtectedRoute("/panel/1"), "/panel-login");
  assert.equal(loginPathForProtectedRoute("/director/applications"), "/director-login");
});

test("staff create roles reject applicant", () => {
  assert.equal(isValidStaffCreateRole("assessor"), true);
  assert.equal(isValidStaffCreateRole("panel"), true);
  assert.equal(isValidStaffCreateRole("director"), true);
  assert.equal(isValidStaffCreateRole("applicant"), false);
});

test("temporary passwords are strong enough", () => {
  const pw = generateTemporaryPassword();
  assert.ok(pw.length >= 12);
  assert.match(pw, /[A-Za-z]/);
  assert.match(pw, /[0-9]/);
});

test("no public staff signup pages exist", () => {
  // Director signup page redirects; assessor/panel signup pages must not exist
  assert.equal(existsSync(resolve("app/(auth)/assessor-register")), false);
  assert.equal(existsSync(resolve("app/(auth)/panel-register")), false);
  assert.equal(existsSync(resolve("app/(auth)/assessor-signup")), false);
  assert.equal(existsSync(resolve("app/(auth)/panel-signup")), false);
  assert.equal(existsSync(resolve("app/(auth)/assessor-login/page.js")), true);
  assert.equal(existsSync(resolve("app/(auth)/panel-login/page.js")), true);
  assert.equal(existsSync(resolve("app/(auth)/director-login/page.js")), true);
  assert.equal(existsSync(resolve("app/api/director/assessors/create/route.js")), true);
  assert.equal(existsSync(resolve("app/api/director/panel/create/route.js")), true);
  assert.equal(existsSync(resolve("scripts/create-staff-user.mjs")), true);
});

test("login path helpers", () => {
  assert.equal(loginPathForRole("assessor"), "/assessor-login");
  assert.equal(loginPathForRole("panel"), "/panel-login");
  assert.equal(loginPathForRole("director"), "/director-login");
  assert.equal(loginPathForRole("applicant"), "/login");
});
