import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  MFA_CHALLENGE_PATH,
  MFA_REQUIRED_CODE,
  MFA_SETUP_PATH,
  isDirectorMfaPath,
  isDirectorMfaRequired,
  mfaRequiredResponse,
  resolveDirectorMfaDestination,
  assertDirectorAal2,
} from "../lib/director-mfa.js";

test("Director MFA setup and challenge pages exist (unused redirect stubs)", () => {
  assert.equal(existsSync(resolve("app/(director-mfa)/director/mfa-setup/page.js")), true);
  assert.equal(existsSync(resolve("app/(director-mfa)/director/mfa-challenge/page.js")), true);
});

test("MFA paths are detected for proxy bounce", () => {
  assert.equal(isDirectorMfaPath(MFA_SETUP_PATH), true);
  assert.equal(isDirectorMfaPath(MFA_CHALLENGE_PATH), true);
  assert.equal(isDirectorMfaPath("/director"), false);
  assert.equal(isDirectorMfaPath("/director/applications"), false);
});

test("mfaRequiredResponse returns 403 MFA_REQUIRED (retained helper)", async () => {
  const res = mfaRequiredResponse();
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, MFA_REQUIRED_CODE);
});

test("isDirectorMfaRequired always false (MFA not in active Director flow)", () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  delete process.env.DIRECTOR_MFA_REQUIRED;
  assert.equal(isDirectorMfaRequired(), false);
  process.env.DIRECTOR_MFA_REQUIRED = "true";
  assert.equal(isDirectorMfaRequired(), false);
  process.env.DIRECTOR_MFA_REQUIRED = "false";
  assert.equal(isDirectorMfaRequired(), false);
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("resolveDirectorMfaDestination always ok without calling Supabase MFA", async () => {
  const dest = await resolveDirectorMfaDestination({
    auth: {
      mfa: {
        listFactors: async () => {
          throw new Error("should not list factors when MFA unused");
        },
        getAuthenticatorAssuranceLevel: async () => {
          throw new Error("should not read AAL when MFA unused");
        },
      },
    },
  });
  assert.equal(dest, "ok");
});

test("assertDirectorAal2 always allows (no AAL2 requirement)", async () => {
  const result = await assertDirectorAal2({
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1" },
          error: null,
        }),
      },
    },
  });
  assert.equal(result.ok, true);
});

test("requireActiveDirector does not wire AAL2 / requireMfa", () => {
  const src = readFileSync(resolve("lib/director-auth.js"), "utf8");
  assert.doesNotMatch(src, /assertDirectorAal2/);
  assert.doesNotMatch(src, /requireMfa/);
  assert.doesNotMatch(src, /DIRECTOR_MFA_REQUIRED/);
  assert.match(src, /isDirectorRole/);
  assert.match(src, /isProfileActive/);
});

test("proxy redirects MFA paths and does not enforce TOTP setup/challenge", () => {
  const src = readFileSync(resolve("proxy.js"), "utf8");
  assert.match(src, /isDirectorMfaPath/);
  assert.match(src, /\/director-login/);
  assert.doesNotMatch(src, /resolveDirectorMfaDestination/);
  assert.doesNotMatch(src, /MFA_SETUP_PATH/);
  assert.doesNotMatch(src, /enforceDirectorMfa/);
  assert.doesNotMatch(src, /DIRECTOR_MFA_REQUIRED/);
});

test("PortalLoginForm does not branch on MFA", () => {
  const src = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
  assert.doesNotMatch(src, /MFA_SETUP_PATH/);
  assert.doesNotMatch(src, /DIRECTOR_MFA_REQUIRED/);
  assert.match(src, /portalHomeForRole/);
});

test("MFA pages redirect away and do not enroll TOTP", () => {
  const setup = readFileSync(resolve("app/(director-mfa)/director/mfa-setup/page.js"), "utf8");
  const challenge = readFileSync(
    resolve("app/(director-mfa)/director/mfa-challenge/page.js"),
    "utf8"
  );
  assert.match(setup, /CURRENTLY UNUSED/);
  assert.match(challenge, /CURRENTLY UNUSED/);
  assert.match(setup, /router\.replace\("\/director"\)/);
  assert.match(challenge, /router\.replace\("\/director"\)/);
  assert.match(setup, /router\.replace\("\/director-login"\)/);
  assert.match(challenge, /router\.replace\("\/director-login"\)/);
  assert.doesNotMatch(setup, /mfa\.enroll/);
  assert.doesNotMatch(challenge, /mfa\.challenge/);
});

test("env example does not require DIRECTOR_MFA_REQUIRED", () => {
  const example = readFileSync(resolve(".env.example"), "utf8");
  assert.doesNotMatch(example, /DIRECTOR_MFA_REQUIRED/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_DIRECTOR_MFA/);
});
