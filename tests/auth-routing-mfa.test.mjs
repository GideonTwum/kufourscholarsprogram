import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  authRouteBouncePath,
  isApplicantEntryAuthPath,
  resolvePostAuthRedirect,
  authRouteBounceSearchParams,
} from "../lib/portal-auth.js";
import { MFA_SETUP_PATH, MFA_CHALLENGE_PATH } from "../lib/director-mfa.js";

test("applicant entry auth paths are detected", () => {
  assert.equal(isApplicantEntryAuthPath("/applicant-register"), true);
  assert.equal(isApplicantEntryAuthPath("/register"), true);
  assert.equal(isApplicantEntryAuthPath("/login"), false);
  assert.equal(isApplicantEntryAuthPath("/director-login"), false);
});

test("Apply Now bounce: directors/staff never go to /director from register", () => {
  assert.equal(authRouteBouncePath("/applicant-register", "director"), "/");
  assert.equal(authRouteBouncePath("/applicant-register", "assessor"), "/");
  assert.equal(authRouteBouncePath("/applicant-register", "panel"), "/");
  assert.equal(authRouteBouncePath("/register", "director"), "/");
  assert.equal(authRouteBouncePath("/applicant-register", "applicant"), "/applicant");
  assert.equal(authRouteBouncePath("/applicant-register", "scholar"), "/applicant");
  assert.deepEqual(authRouteBounceSearchParams("/applicant-register", "director"), {
    notice: "staff-session",
  });
  assert.equal(authRouteBounceSearchParams("/applicant-register", "applicant"), null);
});

test("portal login bounce still sends directors to /director", () => {
  assert.equal(authRouteBouncePath("/director-login", "director"), "/director");
  assert.equal(authRouteBouncePath("/login", "applicant"), "/applicant");
  assert.equal(authRouteBouncePath("/forgot-password", "director"), null);
});

test("post-auth redirect never sends applicants to Director MFA paths", () => {
  assert.equal(resolvePostAuthRedirect("applicant", MFA_SETUP_PATH), "/applicant");
  assert.equal(resolvePostAuthRedirect("applicant", MFA_CHALLENGE_PATH), "/applicant");
  assert.equal(resolvePostAuthRedirect("applicant", "/director"), "/applicant");
  assert.equal(resolvePostAuthRedirect("assessor", MFA_SETUP_PATH), "/assessor");
  assert.equal(resolvePostAuthRedirect("panel", "/director/applications"), "/panel");
  assert.equal(resolvePostAuthRedirect("director", MFA_SETUP_PATH), MFA_SETUP_PATH);
  assert.equal(resolvePostAuthRedirect("applicant", "/applicant/verify-email"), "/applicant/verify-email");
});

test("proxy role-gates Director portal and bounces unused MFA URLs", () => {
  const src = readFileSync(resolve("proxy.js"), "utf8");
  assert.match(src, /authRouteBouncePath/);
  assert.match(src, /isApplicantRole/);
  assert.match(src, /isDirectorMfaPath/);
  assert.match(src, /verifyEmailPath/);
  assert.doesNotMatch(src, /resolveDirectorMfaDestination/);
});

test("auth callback forces applicant verification to login without leaving session", () => {
  const src = readFileSync(resolve("app/auth/callback/route.js"), "utf8");
  assert.match(src, /exchangeCodeForSession/);
  assert.match(src, /signOut/);
  assert.match(src, /\/login\?verified=true/);
  assert.match(src, /isApplicantEmailVerificationNext|isApplicantRole/);
  assert.match(src, /reset-password/);
});

test("MFA pages redirect directors to /director without enrollment UI", () => {
  const setup = readFileSync(resolve("app/(director-mfa)/director/mfa-setup/page.js"), "utf8");
  const challenge = readFileSync(
    resolve("app/(director-mfa)/director/mfa-challenge/page.js"),
    "utf8"
  );
  assert.match(setup, /\/director/);
  assert.match(challenge, /\/director/);
  assert.match(setup, /\/director-login/);
  assert.match(challenge, /\/director-login/);
  assert.doesNotMatch(setup, /mfa\.enroll/);
  assert.doesNotMatch(challenge, /mfa\.verify/);
});
