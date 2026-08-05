import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  isValidEmailFormat,
  loginPathForRecoveryPortal,
  normalizeRecoveryPortal,
  passwordResetCallbackUrl,
} from "../lib/auth-recovery.js";
import { validatePasswordPolicy } from "../lib/password-policy.js";
import { safeAuthRedirectPath } from "../lib/application-status-transition.mjs";
import { consumeRateLimit, __resetRateLimitBucketsForTests } from "../lib/auth-rate-limit.js";
import { loginPathForRole } from "../lib/portal-auth.js";

test("forgot-password and reset-password pages exist", () => {
  assert.equal(existsSync(resolve("app/(auth)/forgot-password/page.js")), true);
  assert.equal(existsSync(resolve("app/(auth)/reset-password/page.js")), true);
  assert.equal(existsSync(resolve("app/api/auth/forgot-password/route.js")), true);
});

test("forgot-password API always returns generic success message constant", () => {
  const src = readFileSync(resolve("app/api/auth/forgot-password/route.js"), "utf8");
  assert.match(src, /FORGOT_PASSWORD_SUCCESS_MESSAGE/);
  assert.match(src, /resetPasswordForEmail/);
  assert.ok(FORGOT_PASSWORD_SUCCESS_MESSAGE.includes("If an account exists"));
});

test("recovery portal allowlist rejects arbitrary values", () => {
  assert.equal(normalizeRecoveryPortal("director"), "director");
  assert.equal(normalizeRecoveryPortal("evil"), "applicant");
  assert.equal(normalizeRecoveryPortal("//evil.com"), "applicant");
  assert.equal(loginPathForRecoveryPortal("assessor"), "/assessor-login");
  assert.equal(loginPathForRecoveryPortal("panel"), "/panel-login");
  assert.equal(loginPathForRecoveryPortal("director"), "/director-login");
});

test("password reset callback URL is internal and uses safe next", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://scholars.example.com";
  const url = passwordResetCallbackUrl();
  assert.match(url, /^https:\/\/scholars\.example\.com\/auth\/callback\?next=/);
  assert.ok(url.includes(encodeURIComponent("/reset-password")));
  assert.equal(safeAuthRedirectPath("/reset-password", "/reset-password"), "/reset-password");
  assert.equal(safeAuthRedirectPath("https://evil.com", "/reset-password"), "/reset-password");
  assert.equal(safeAuthRedirectPath("//evil.com", "/reset-password"), "/reset-password");
});

test("email format validation", () => {
  assert.equal(isValidEmailFormat("a@b.co"), true);
  assert.equal(isValidEmailFormat("not-an-email"), false);
  assert.equal(isValidEmailFormat(""), false);
});

test("password policy rejects weak passwords", () => {
  assert.equal(validatePasswordPolicy("short").ok, false);
  assert.equal(validatePasswordPolicy("allletters").ok, false);
  assert.equal(validatePasswordPolicy("12345678").ok, false);
  assert.equal(validatePasswordPolicy("GoodPass1").ok, true);
});

test("successful reset returns portal-correct login paths", () => {
  assert.equal(loginPathForRole("applicant"), "/login");
  assert.equal(loginPathForRole("assessor"), "/assessor-login");
  assert.equal(loginPathForRole("panel"), "/panel-login");
  assert.equal(loginPathForRole("director"), "/director-login");
  const resetSrc = readFileSync(resolve("app/(auth)/reset-password/page.js"), "utf8");
  assert.match(resetSrc, /loginPathForRole/);
  assert.match(resetSrc, /updateUser\(\{\s*password/);
  assert.match(resetSrc, /signOut/);
  assert.match(resetSrc, /does not reactivate/);
});

test("forgot-password rate limit is best-effort and bounded", () => {
  __resetRateLimitBucketsForTests();
  assert.equal(consumeRateLimit("t1", { max: 2, windowMs: 60_000 }).allowed, true);
  assert.equal(consumeRateLimit("t1", { max: 2, windowMs: 60_000 }).allowed, true);
  const blocked = consumeRateLimit("t1", { max: 2, windowMs: 60_000 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);
});

test("PortalLoginForm links forgot-password with portal query", () => {
  const src = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
  assert.match(src, /forgot-password\?portal=/);
});
