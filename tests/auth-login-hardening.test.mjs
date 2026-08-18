import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const staffCredentials = readFileSync(resolve("lib/staff-credentials.js"), "utf8");
const portalLogin = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
const applicantRegister = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
const manageDirector = readFileSync(resolve("scripts/manage-director-user.mjs"), "utf8");

test("staff createUser passes password and email_confirm", () => {
  assert.match(staffCredentials, /admin\.auth\.admin\.createUser\(\{/);
  assert.match(staffCredentials, /password:\s*temporaryPassword/);
  assert.match(staffCredentials, /email_confirm:\s*true/);
});

test("staff create verifies password with anon signInWithPassword", () => {
  assert.match(staffCredentials, /signInWithPassword/);
  assert.match(staffCredentials, /updateUserById\(userId,\s*\{[\s\S]*password:\s*temporaryPassword/);
});

test("staff create normalizes email but not password", () => {
  assert.match(staffCredentials, /email\.trim\(\)\.toLowerCase\(\)/);
  assert.doesNotMatch(staffCredentials, /password\.trim\(/);
  assert.doesNotMatch(staffCredentials, /password\.toLowerCase\(/);
});

test("portal login normalizes email and maps auth errors distinctly", () => {
  assert.match(portalLogin, /email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(portalLogin, /Please verify your email before signing in/);
  assert.match(portalLogin, /Invalid email or password/);
  assert.doesNotMatch(portalLogin, /password\.trim\(/);
  assert.doesNotMatch(portalLogin, /password\.toLowerCase\(/);
});

test("applicant register confirmation redirects to verify-email not dashboard", () => {
  assert.match(applicantRegister, /\/applicant\/verify-email/);
  assert.match(applicantRegister, /auth\/callback\?next=\/login/);
});

test("applicant register normalizes email and does not mutate password", () => {
  assert.match(applicantRegister, /email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(applicantRegister, /signUp\(\{[\s\S]*email:\s*normalizedEmail[\s\S]*password,/);
  assert.doesNotMatch(applicantRegister, /password\.trim\(/);
  assert.doesNotMatch(applicantRegister, /password\.toLowerCase\(/);
  assert.match(applicantRegister, /validatePasswordPolicy/);
});

test("director manage script uses createStaffUserWithAdmin and .env.local URL", () => {
  assert.match(manageDirector, /createStaffUserWithAdmin/);
  assert.match(manageDirector, /loadEnvFile\(resolve\(process\.cwd\(\),\s*"\.env\.local"\)\)/);
  assert.match(manageDirector, /NEXT_PUBLIC_SUPABASE_URL/);
});
