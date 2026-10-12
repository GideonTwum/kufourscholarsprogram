import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyEmailChangeError,
  redactEmailText,
  validateEmailChangeRequest,
} from "../lib/applicant-email-change.js";
import { emailChangeStillPending, planVerifiedEmailSync } from "../lib/applicant-email-sync.js";
import { normalizeEmailConfirmOtpType } from "../lib/auth-email-confirm.js";

test("valid email change request is accepted", () => {
  const result = validateEmailChangeRequest("old@example.com", "New@Example.com");
  assert.equal(result.ok, true);
  assert.equal(result.email, "new@example.com");
});

test("invalid, unchanged, and duplicate-style addresses are rejected", () => {
  assert.match(validateEmailChangeRequest("old@example.com", "not-an-email").error, /valid email/);
  assert.match(validateEmailChangeRequest("old@example.com", "old@example.com").error, /already your email/);
  const duplicate = classifyEmailChangeError({ code: "email_exists", message: "already registered user@secret.test" });
  assert.equal(duplicate.status, 409);
  assert.doesNotMatch(duplicate.error, /secret\.test/);
});

test("expired session, rate limit, and auth timeout stay actionable", () => {
  assert.equal(classifyEmailChangeError({ status: 401, message: "jwt expired" }).code, "session_expired");
  assert.equal(classifyEmailChangeError({ status: 429, code: "over_email_send_rate_limit" }).status, 429);
  assert.equal(classifyEmailChangeError({ code: "timeout" }).status, 504);
  assert.doesNotMatch(redactEmailText("failed for user@example.com token_hash=abc"), /user@example.com|token_hash=abc/);
});

test("pending verification does not replace the confirmed address", () => {
  const plan = planVerifiedEmailSync({
    authEmail: "old@example.com",
    emailConfirmedAt: "2026-10-12T00:00:00.000Z",
    pendingEmail: "new@example.com",
    profileEmail: "old@example.com",
  });
  assert.equal(plan.reason, "pending");
  assert.equal(emailChangeStillPending({ email: "old@example.com", new_email: "new@example.com" }), true);
  assert.equal(emailChangeStillPending({ email: "new@example.com", new_email: "" }), false);
});

test("second confirmation can sync and a repeat is a no-op", () => {
  const ready = planVerifiedEmailSync({
    authEmail: "new@example.com",
    emailConfirmedAt: "2026-10-12T00:00:00.000Z",
    pendingEmail: "",
    profileEmail: "old@example.com",
  });
  assert.equal(ready.action, "update");
  const again = planVerifiedEmailSync({
    authEmail: "new@example.com",
    emailConfirmedAt: "2026-10-12T00:00:00.000Z",
    pendingEmail: "",
    profileEmail: "new@example.com",
  });
  assert.equal(again.reason, "unchanged");
});

test("email form, limiter, confirm type, and recovery stay separated", () => {
  const page = readFileSync(resolve("app/(applicant)/applicant/profile/page.js"), "utf8");
  assert.match(page, /Change Email/);
  assert.match(page, /Sending Verification\.\.\./);
  assert.match(page, /disabled=\{saving\}/);
  assert.match(page, /finally/);
  assert.match(page, /EMAIL_CHANGE_SENT_MESSAGE/);
  assert.match(page, /not active yet/);
  const route = readFileSync(resolve("app/api/applicant/account/email/route.js"), "utf8");
  assert.match(route, /updateUser/);
  assert.match(route, /emailRedirectTo/);
  assert.match(route, /rate_limit_unavailable/);
  assert.match(route, /pending_verification/);
  assert.doesNotMatch(route, /profiles"\)[\s\S]*update\(\{\s*email/);
  assert.doesNotMatch(route, /console\.(log|info|error)\([^)]*validation\.email/);
  const limiter = readFileSync(resolve("lib/persistent-rate-limit.js"), "utf8");
  assert.match(limiter, /p_attempt_key/);
  assert.match(limiter, /max_attempts/);
  assert.match(limiter, /window_seconds/);
  assert.match(limiter, /database_error/);
  const confirm = readFileSync(resolve("app/auth/confirm/route.js"), "utf8");
  assert.match(confirm, /email_change/);
  assert.match(confirm, /emailChangeStillPending/);
  assert.match(confirm, /verifiedLoginPath/);
  assert.equal(normalizeEmailConfirmOtpType("recovery"), null);
  assert.equal(normalizeEmailConfirmOtpType("email"), "email");
  const director = readFileSync(resolve("app/(dashboard)/director/applications/[id]/page.js"), "utf8");
  assert.match(director, /profile\?\.email/);
  const recovery = readFileSync(resolve("lib/applicant-account-recovery.js"), "utf8");
  assert.match(recovery, /password_reset/);
  const callback = readFileSync(resolve("app/auth/callback/route.js"), "utf8");
  assert.doesNotMatch(callback, /reset-password[\s\S]{0,200}signOut/);
});
