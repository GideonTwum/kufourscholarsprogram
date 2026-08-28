import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applicantEmailConfirmBaseUrl,
  applicantEmailConfirmRedirectTo,
  isEmailConfirmOtpType,
  normalizeEmailConfirmOtpType,
  verificationErrorLoginPath,
  verifiedLoginPath,
} from "../lib/auth-email-confirm.js";
import { safeAuthRedirectPath } from "../lib/application-status-transition.mjs";

test("normalizeEmailConfirmOtpType accepts email and signup only", () => {
  assert.equal(normalizeEmailConfirmOtpType("email"), "email");
  assert.equal(normalizeEmailConfirmOtpType("signup"), "signup");
  assert.equal(normalizeEmailConfirmOtpType("EMAIL"), "email");
  assert.equal(normalizeEmailConfirmOtpType("recovery"), null);
  assert.equal(normalizeEmailConfirmOtpType("magiclink"), null);
  assert.equal(normalizeEmailConfirmOtpType(""), null);
  assert.equal(isEmailConfirmOtpType("email"), true);
  assert.equal(isEmailConfirmOtpType("invite"), false);
});

test("verified and error login paths never embed raw errors", () => {
  assert.equal(verifiedLoginPath("https://www.kufuorscholarapplication.com"), "https://www.kufuorscholarapplication.com/login?verified=true");
  assert.equal(
    verificationErrorLoginPath("https://www.kufuorscholarapplication.com"),
    "https://www.kufuorscholarapplication.com/login?verification_error=1"
  );
  assert.doesNotMatch(verificationErrorLoginPath("https://x.test"), /error\.|token|jwt/i);
});

test("applicantEmailConfirmRedirectTo uses Site URL origin (allowlist-safe)", () => {
  assert.equal(
    applicantEmailConfirmRedirectTo("https://www.kufuorscholarapplication.com"),
    "https://www.kufuorscholarapplication.com"
  );
  assert.equal(
    applicantEmailConfirmBaseUrl("https://www.kufuorscholarapplication.com"),
    "https://www.kufuorscholarapplication.com/auth/confirm"
  );
});

test("callback/confirm prevent open redirects via safeAuthRedirectPath", () => {
  assert.equal(safeAuthRedirectPath("https://evil.test", "/login"), "/login");
  assert.equal(safeAuthRedirectPath("//evil.test", "/login"), "/login");
  assert.equal(safeAuthRedirectPath("/login", "/applicant"), "/login");
});

test("confirm route source rejects missing token and unsupported type safely", () => {
  const src = readFileSync(resolve("app/auth/confirm/route.js"), "utf8");
  assert.match(src, /missing_token_hash|Missing token_hash/);
  assert.match(src, /unsupported_type/);
  assert.match(src, /verificationErrorLoginPath/);
  assert.match(src, /verifyOtp/);
  assert.match(src, /signOut/);
  assert.doesNotMatch(src, /encodeURIComponent\(error\.message\)/);
});

test("confirm route does not log token_hash values", () => {
  const src = readFileSync(resolve("app/auth/confirm/route.js"), "utf8");
  assert.match(src, /logEmailVerificationEvent/);
  const logBlocks = [...src.matchAll(/logEmailVerificationEvent\(([\s\S]*?)\);/g)].map((m) => m[1]);
  assert.ok(logBlocks.length >= 1);
  for (const block of logBlocks) {
    assert.doesNotMatch(block, /token_hash\s*:/);
  }
});
