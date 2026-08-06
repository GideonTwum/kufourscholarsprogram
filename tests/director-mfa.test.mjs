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

test("isDirectorMfaRequired defaults to true when unset", () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  delete process.env.DIRECTOR_MFA_REQUIRED;
  assert.equal(isDirectorMfaRequired(), true);
  process.env.DIRECTOR_MFA_REQUIRED = "true";
  assert.equal(isDirectorMfaRequired(), true);
  process.env.DIRECTOR_MFA_REQUIRED = "false";
  assert.equal(isDirectorMfaRequired(), false);
  process.env.DIRECTOR_MFA_REQUIRED = "FALSE";
  assert.equal(isDirectorMfaRequired(), false);
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("MFA OFF: resolveDirectorMfaDestination is ok without calling Supabase MFA", async () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  process.env.DIRECTOR_MFA_REQUIRED = "false";
  const dest = await resolveDirectorMfaDestination({
    auth: {
      mfa: {
        listFactors: async () => {
          throw new Error("should not list factors when MFA off");
        },
        getAuthenticatorAssuranceLevel: async () => {
          throw new Error("should not read AAL when MFA off");
        },
      },
    },
  });
  assert.equal(dest, "ok");
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("MFA OFF: assertDirectorAal2 allows AAL1", async () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  process.env.DIRECTOR_MFA_REQUIRED = "false";
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
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("MFA ON: resolveDirectorMfaDestination setup when no factors", async () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  process.env.DIRECTOR_MFA_REQUIRED = "true";
  const dest = await resolveDirectorMfaDestination({
    auth: {
      mfa: {
        listFactors: async () => ({ data: { totp: [] }, error: null }),
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1" },
          error: null,
        }),
      },
    },
  });
  assert.equal(dest, "setup");
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("MFA ON: resolveDirectorMfaDestination challenge when AAL1 with factor", async () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  process.env.DIRECTOR_MFA_REQUIRED = "true";
  const dest = await resolveDirectorMfaDestination({
    auth: {
      mfa: {
        listFactors: async () => ({
          data: { totp: [{ id: "f1", status: "verified" }] },
          error: null,
        }),
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: "aal1" },
          error: null,
        }),
      },
    },
  });
  assert.equal(dest, "challenge");
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("MFA ON: assertDirectorAal2 rejects AAL1", async () => {
  const prev = process.env.DIRECTOR_MFA_REQUIRED;
  process.env.DIRECTOR_MFA_REQUIRED = "true";
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
  assert.equal(result.ok, false);
  assert.equal(result.error.status, 403);
  if (prev === undefined) delete process.env.DIRECTOR_MFA_REQUIRED;
  else process.env.DIRECTOR_MFA_REQUIRED = prev;
});

test("requireActiveDirector still wires assertDirectorAal2", () => {
  const src = readFileSync(resolve("lib/director-auth.js"), "utf8");
  assert.match(src, /assertDirectorAal2/);
  assert.match(src, /requireMfa/);
  assert.match(src, /DIRECTOR_MFA_REQUIRED/);
});

test("proxy still uses resolveDirectorMfaDestination for Director routes", () => {
  const src = readFileSync(resolve("proxy.js"), "utf8");
  assert.match(src, /resolveDirectorMfaDestination/);
  assert.match(src, /MFA_SETUP_PATH/);
  assert.match(src, /MFA_CHALLENGE_PATH/);
  assert.match(src, /DIRECTOR_MFA_REQUIRED|resolveDirectorMfaDestination/);
});

test("PortalLoginForm defers MFA to proxy (no client env MFA branch)", () => {
  const src = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
  assert.doesNotMatch(src, /MFA_SETUP_PATH/);
  assert.match(src, /portalHomeForRole/);
  assert.match(src, /enforced server-side in proxy/);
});

test("MFA pages and helpers remain in the codebase", () => {
  const mfa = readFileSync(resolve("lib/director-mfa.js"), "utf8");
  assert.match(mfa, /mfa\.enroll|listFactors|getAuthenticatorAssuranceLevel/);
  assert.match(mfa, /isDirectorMfaRequired/);
  const setup = readFileSync(resolve("app/(director-mfa)/director/mfa-setup/page.js"), "utf8");
  assert.match(setup, /mfa\.enroll/);
});

test("env example documents DIRECTOR_MFA_REQUIRED", () => {
  const example = readFileSync(resolve(".env.example"), "utf8");
  assert.match(example, /DIRECTOR_MFA_REQUIRED/);
  assert.doesNotMatch(example, /NEXT_PUBLIC_DIRECTOR_MFA/);
});
