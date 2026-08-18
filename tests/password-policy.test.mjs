import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  getPasswordPolicyChecks,
  passwordStrengthLabel,
  passwordsMatch,
  validatePasswordPolicy,
} from "../lib/password-policy.js";

test("password policy rejects 7 characters", () => {
  const r = validatePasswordPolicy("Abcdef1");
  assert.equal(r.ok, false);
  assert.equal(r.minLength, false);
  assert.equal(r.message, PASSWORD_POLICY_MESSAGE);
});

test("password policy rejects missing uppercase", () => {
  const r = validatePasswordPolicy("password1!");
  assert.equal(r.ok, false);
  assert.equal(r.uppercase, false);
  assert.equal(r.lowercase, true);
  assert.equal(r.number, true);
  assert.equal(r.specialCharacter, true);
});

test("password policy rejects missing lowercase", () => {
  const r = validatePasswordPolicy("PASSWORD1!");
  assert.equal(r.ok, false);
  assert.equal(r.lowercase, false);
  assert.equal(r.uppercase, true);
});

test("password policy rejects missing number", () => {
  const r = validatePasswordPolicy("Password!");
  assert.equal(r.ok, false);
  assert.equal(r.number, false);
});

test("password policy rejects missing special character", () => {
  const r = validatePasswordPolicy("Password1");
  assert.equal(r.ok, false);
  assert.equal(r.specialCharacter, false);
  assert.equal(r.minLength, true);
  assert.equal(r.uppercase, true);
  assert.equal(r.lowercase, true);
  assert.equal(r.number, true);
});

test("password policy accepts strong examples", () => {
  for (const pw of ["KspStrong1!", "FutureLeader@2026", "Scholar#Pass9"]) {
    const r = validatePasswordPolicy(pw);
    assert.equal(r.ok, true, pw);
    assert.equal(r.valid, true, pw);
  }
});

test("password policy rejects known weak examples", () => {
  for (const pw of ["password", "Password", "Password1", "12345678", "PASSWORD1!"]) {
    assert.equal(validatePasswordPolicy(pw).ok, false, pw);
  }
});

test("password policy does not trim or lowercase the value under test", () => {
  // Leading/trailing spaces are characters — length still counts them, but
  // helpers must evaluate the exact string without mutating callers.
  const spaced = " KspStrong1! ";
  const checks = getPasswordPolicyChecks(spaced);
  assert.equal(checks.minLength, true);
  assert.equal(checks.valid, true);
  assert.equal(spaced, " KspStrong1! ");
  assert.equal(PASSWORD_MIN_LENGTH, 8);
});

test("passwordsMatch requires exact equality and non-empty password", () => {
  assert.equal(passwordsMatch("KspStrong1!", "KspStrong1!"), true);
  assert.equal(passwordsMatch("KspStrong1!", "KspStrong1"), false);
  assert.equal(passwordsMatch("", ""), false);
  assert.equal(passwordsMatch("KspStrong1!", ""), false);
});

test("passwordStrengthLabel maps requirement counts", () => {
  assert.equal(passwordStrengthLabel(getPasswordPolicyChecks("ab")), "Weak");
  assert.equal(passwordStrengthLabel(getPasswordPolicyChecks("Password1")), "Fair");
  assert.equal(passwordStrengthLabel(getPasswordPolicyChecks("KspStrong1!")), "Strong");
});

test("applicant register uses shared policy, confirm match, and live checklist", () => {
  const register = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
  assert.match(register, /validatePasswordPolicy/);
  assert.match(register, /PasswordPolicyChecklist/);
  assert.match(register, /passwordsMatch/);
  assert.match(register, /Confirm Password/);
  assert.match(register, /canSubmit/);
  assert.match(register, /PASSWORD_POLICY_MESSAGE/);
  assert.match(register, /signUp\(\{[\s\S]*?email:\s*normalizedEmail[\s\S]*?password,/);
  assert.doesNotMatch(register, /password\.trim\(/);
  assert.doesNotMatch(register, /password\.toLowerCase\(/);
  const signUpBlock = register.match(/supabase\.auth\.signUp\(\{[\s\S]*?\}\);/);
  assert.ok(signUpBlock, "expected signUp call");
  assert.doesNotMatch(signUpBlock[0], /confirmPassword/);
  assert.match(register, /disabled=\{!canSubmit\}/);
});

test("confirm mismatch blocks submit; match enables when other fields valid", () => {
  const register = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
  assert.match(register, /confirmOk/);
  assert.match(register, /Passwords do not match/);
  assert.match(
    register,
    /canSubmit = nameOk && emailOk && policy\.valid && confirmOk && !loading/
  );
});

test("reset password page uses the same shared password policy", () => {
  const reset = readFileSync(resolve("app/(auth)/reset-password/page.js"), "utf8");
  assert.match(reset, /from "@\/lib\/password-policy"/);
  assert.match(reset, /validatePasswordPolicy/);
  assert.match(reset, /PasswordPolicyChecklist/);
  assert.match(reset, /PASSWORD_POLICY_MESSAGE/);
  assert.match(reset, /passwordsMatch/);
  assert.match(reset, /disabled=\{!canSubmit\}/);
  assert.doesNotMatch(reset, /password\.trim\(/);
  assert.doesNotMatch(reset, /password\.toLowerCase\(/);
});

test("shared checklist component announces summary politely", () => {
  const src = readFileSync(
    resolve("components/auth/PasswordPolicyChecklist.jsx"),
    "utf8"
  );
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /getPasswordPolicyChecks/);
  assert.match(src, /PASSWORD_REQUIREMENT_LABELS/);
});
