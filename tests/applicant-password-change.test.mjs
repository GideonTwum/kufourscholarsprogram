import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyPasswordChangeError,
  validatePasswordChange,
} from "../lib/password-policy.js";

const valid = {
  currentPassword: "OldPass1!",
  newPassword: "NewPass2!",
  confirmPassword: "NewPass2!",
};

test("valid new password passes the existing policy", () => {
  assert.equal(validatePasswordChange(valid).ok, true);
});

test("incorrect confirmation is rejected on the confirm field", () => {
  const result = validatePasswordChange({ ...valid, confirmPassword: "NewPass2?" });
  assert.equal(result.ok, false);
  assert.match(result.fields.confirmPassword, /do not match/);
});

test("weak new password uses the existing policy message", () => {
  const result = validatePasswordChange({ ...valid, newPassword: "password", confirmPassword: "password" });
  assert.equal(result.ok, false);
  assert.match(result.fields.newPassword, /security requirements/);
});

test("missing fields are reported separately", () => {
  const result = validatePasswordChange({ currentPassword: "", newPassword: "", confirmPassword: "" });
  assert.equal(result.fields.currentPassword, "Current password is required.");
  assert.equal(result.fields.newPassword, "New password is required.");
  assert.equal(result.fields.confirmPassword, "Confirm your new password.");
});

test("reusing the current password is rejected", () => {
  const result = validatePasswordChange({
    currentPassword: "SamePass1!",
    newPassword: "SamePass1!",
    confirmPassword: "SamePass1!",
  });
  assert.match(result.fields.newPassword, /different from your current password/);
});

test("expired session and Auth failures stay free of secrets", () => {
  const expired = classifyPasswordChangeError({ status: 401, message: "jwt expired secret-password" }, "update");
  assert.equal(expired.code, "session_expired");
  assert.doesNotMatch(expired.error, /secret-password/);
  const wrong = classifyPasswordChangeError({ code: "invalid_credentials", message: "Invalid login credentials" }, "verify");
  assert.equal(wrong.error, "Current password is incorrect.");
  const auth = classifyPasswordChangeError({ code: "weak_password", message: "Password should be at least 8 characters" }, "update");
  assert.equal(auth.field, "newPassword");
});

test("password form shows requirements, loading, and recovery separately", () => {
  const page = readFileSync(resolve("app/(applicant)/applicant/profile/page.js"), "utf8");
  assert.match(page, /Update Password/);
  assert.match(page, /Updating Password\.\.\./);
  assert.match(page, /PasswordPolicyChecklist/);
  assert.match(page, /showWhenEmpty/);
  assert.match(page, /Password updated successfully\./);
  assert.match(page, /disabled=\{saving\}/);
  assert.match(page, /\/forgot-password/);
  assert.match(page, /\/login/);
  assert.doesNotMatch(page, /PASSWORD_POLICY_MESSAGE/);
  const route = readFileSync(resolve("app/api/applicant/account/password/route.js"), "utf8");
  assert.match(route, /persistSession: false/);
  assert.match(route, /updateUser\(\{\s*password:\s*nextPassword\s*\}\)/);
  assert.doesNotMatch(route, /from\("applications"\)/);
  assert.doesNotMatch(route, /console\.(log|info|error|warn)/);
  const recovery = readFileSync(resolve("lib/applicant-account-recovery.js"), "utf8");
  assert.match(recovery, /password_reset/);
});
