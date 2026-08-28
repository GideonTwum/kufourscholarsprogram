import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("applicant register reports diagnostics and handles empty identities", () => {
  const src = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
  assert.match(src, /classifySignupAuthFailure/);
  assert.match(src, /isLikelyExistingUnconfirmedSignup/);
  assert.match(src, /signup-diagnostic/);
  assert.match(src, /AUTH_REGISTER_EXISTING_HINT/);
  assert.doesNotMatch(src, /setError\(authError\.message\)/);
});

test("signup emailRedirectTo uses allowlist-safe Site URL helper", () => {
  const confirm = readFileSync(resolve("lib/auth-email-confirm.js"), "utf8");
  assert.match(confirm, /always allowed/);
  assert.match(confirm, /applicantEmailConfirmRedirectTo/);
  const register = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
  assert.match(register, /emailRedirectTo:\s*redirectUrl/);
});

test("handle_new_user signup safety migration hardcodes applicant", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/202608280002_handle_new_user_signup_safety.sql"),
    "utf8"
  );
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.handle_new_user/);
  assert.match(sql, /'applicant'/);
  assert.doesNotMatch(sql, /raw_user_meta_data->>'role'/);
});
