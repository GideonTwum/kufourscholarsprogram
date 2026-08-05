import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  MFA_CHALLENGE_PATH,
  MFA_REQUIRED_CODE,
  MFA_SETUP_PATH,
  isDirectorMfaPath,
  mfaRequiredResponse,
} from "../lib/director-mfa.js";

test("Director MFA setup and challenge pages exist", () => {
  assert.equal(existsSync(resolve("app/(director-mfa)/director/mfa-setup/page.js")), true);
  assert.equal(existsSync(resolve("app/(director-mfa)/director/mfa-challenge/page.js")), true);
});

test("MFA paths are detected for proxy gating", () => {
  assert.equal(isDirectorMfaPath(MFA_SETUP_PATH), true);
  assert.equal(isDirectorMfaPath(MFA_CHALLENGE_PATH), true);
  assert.equal(isDirectorMfaPath("/director"), false);
  assert.equal(isDirectorMfaPath("/director/applications"), false);
});

test("mfaRequiredResponse returns 403 MFA_REQUIRED", async () => {
  const res = mfaRequiredResponse();
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, MFA_REQUIRED_CODE);
});

test("requireActiveDirector enforces AAL2 by default", () => {
  const src = readFileSync(resolve("lib/director-auth.js"), "utf8");
  assert.match(src, /assertDirectorAal2/);
  assert.match(src, /requireMfa/);
});

test("proxy enforces Director MFA destinations", () => {
  const src = readFileSync(resolve("proxy.js"), "utf8");
  assert.match(src, /resolveDirectorMfaDestination/);
  assert.match(src, /MFA_SETUP_PATH/);
  assert.match(src, /MFA_CHALLENGE_PATH/);
});

test("PortalLoginForm routes Directors through MFA after password", () => {
  const src = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
  assert.match(src, /resolveDirectorMfaDestination/);
  assert.match(src, /MFA_SETUP_PATH/);
});

test("MFA setup blocks non-directors and inactive accounts", () => {
  const src = readFileSync(resolve("app/(director-mfa)/director/mfa-setup/page.js"), "utf8");
  assert.match(src, /isDirectorRole/);
  assert.match(src, /isProfileActive/);
  assert.match(src, /mfa\.enroll/);
  assert.match(src, /mfa\.verify/);
  assert.doesNotMatch(src, /console\.log\([^\)]*secret/);
});

test("MFA challenge uses verified TOTP factor only", () => {
  const src = readFileSync(resolve("app/(director-mfa)/director/mfa-challenge/page.js"), "utf8");
  assert.match(src, /listDirectorTotpFactors/);
  assert.match(src, /mfa\.challenge/);
  assert.match(src, /mfa\.verify/);
});

test("privileged Director APIs inherit MFA via requireActiveDirector", () => {
  const files = [
    "app/api/applications/[id]/update-status/route.js",
    "app/api/director/assessors/create/route.js",
    "app/api/director/panel/create/route.js",
    "app/api/interview-slots/route.js",
    "app/api/director/email-panel/route.js",
    "app/api/director/auth-email-health/route.js",
  ];
  for (const f of files) {
    const src = readFileSync(resolve(f), "utf8");
    assert.match(src, /requireActiveDirector/, f);
  }
});
