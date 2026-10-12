import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { planVerifiedEmailSync } from "../lib/applicant-email-sync.js";
import { isEmailChangeOtpType, normalizeEmailConfirmOtpType } from "../lib/auth-email-confirm.js";
import { isMissingProfileRpc } from "../lib/applicant-profile-commit.js";
import { persistentRateLimitKey } from "../lib/persistent-rate-limit.js";

const LIVE_REASON =
  "NOT RUN: live Supabase writes need an isolated staging database. The local env was not used, so production applicant data was not touched.";

test("verified email sync updates only a confirmed address with no pending change", () => {
  const plan = planVerifiedEmailSync({
    authEmail: "new@example.com",
    emailConfirmedAt: "2026-10-12T00:00:00.000Z",
    pendingEmail: "",
    profileEmail: "old@example.com",
  });
  assert.equal(plan.action, "update");
  assert.equal(plan.email, "new@example.com");
  assert.equal(plan.previous, "old@example.com");
});

test("pending or unconfirmed addresses are not treated as verified", () => {
  assert.equal(
    planVerifiedEmailSync({
      authEmail: "old@example.com",
      emailConfirmedAt: "2026-10-12T00:00:00.000Z",
      pendingEmail: "new@example.com",
      profileEmail: "old@example.com",
    }).reason,
    "pending"
  );
  assert.equal(
    planVerifiedEmailSync({
      authEmail: "new@example.com",
      emailConfirmedAt: null,
      pendingEmail: "",
      profileEmail: "old@example.com",
    }).reason,
    "unconfirmed"
  );
});

test("repeating a completed email sync is a no-op", () => {
  const plan = planVerifiedEmailSync({
    authEmail: "new@example.com",
    emailConfirmedAt: "2026-10-12T00:00:00.000Z",
    pendingEmail: "",
    profileEmail: "NEW@example.com",
  });
  assert.equal(plan.reason, "unchanged");
});

test("signup confirmation types stay separate from email change", () => {
  assert.equal(normalizeEmailConfirmOtpType("email_change"), null);
  assert.equal(normalizeEmailConfirmOtpType("recovery"), null);
  assert.equal(isEmailChangeOtpType("email_change"), true);
  assert.equal(isEmailChangeOtpType("email"), false);
  const confirm = readFileSync(resolve("app/auth/confirm/route.js"), "utf8");
  assert.match(confirm, /emailChange \? "email_change"/);
  assert.match(confirm, /verifiedLoginPath/);
  const callback = readFileSync(resolve("app/auth/callback/route.js"), "utf8");
  assert.match(callback, /\/reset-password/);
  assert.doesNotMatch(callback, /reset-password[\s\S]{0,200}signOut/);
});

test("shared rate limit key matches the existing 64-character database function", () => {
  const key = persistentRateLimitKey("applicant-password:user-1");
  assert.equal(key.length, 64);
  assert.match(key, /^[0-9a-f]+$/);
  const src = readFileSync(resolve("lib/persistent-rate-limit.js"), "utf8");
  assert.match(src, /consume_director_signup_attempt/);
  assert.match(src, /source: "memory"/);
});

test("atomic profile save is preferred and compensating rollback remains the fallback", () => {
  assert.equal(isMissingProfileRpc({ code: "PGRST202", message: "not found" }), true);
  assert.equal(isMissingProfileRpc({ message: "permission denied" }), false);
  const route = readFileSync(resolve("app/api/applicant/profile/route.js"), "utf8");
  assert.match(route, /commitApplicantProfileAtomically/);
  assert.match(route, /rollbackApplications/);
  const sql = readFileSync(resolve("supabase/migrations/202610120001_applicant_profile_sync.sql"), "utf8");
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /actor_type', 'applicant'/);
  assert.doesNotMatch(sql, /password/);
});

test("bio and avatar upload keep the existing avatars bucket rules", () => {
  const page = readFileSync(resolve("app/(applicant)/applicant/profile/page.js"), "utf8");
  const api = readFileSync(resolve("app/api/applicant/profile/bio/route.js"), "utf8");
  assert.match(page, /from\("avatars"\)/);
  assert.match(page, /jpg\|jpeg\|png/);
  assert.match(page, /5 \* 1024 \* 1024/);
  assert.match(api, /\/storage\/v1\/object\/public\/avatars\//);
  assert.doesNotMatch(api, /from\("applications"\)/);
});

test("LIVE verified email synchronization against a database", { skip: LIVE_REASON }, () => {});
test("LIVE password change against Supabase Auth", { skip: LIVE_REASON }, () => {});
test("LIVE profile and application synchronization", { skip: LIVE_REASON }, () => {});
test("LIVE audit writes", { skip: LIVE_REASON }, () => {});
test("LIVE rollback and concurrency failures", { skip: LIVE_REASON }, () => {});
