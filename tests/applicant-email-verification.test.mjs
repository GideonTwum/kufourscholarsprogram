import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const register = readFileSync(resolve("app/(auth)/applicant-register/page.js"), "utf8");
const verify = readFileSync(resolve("app/(applicant)/applicant/verify-email/page.js"), "utf8");
const callback = readFileSync(resolve("app/auth/callback/route.js"), "utf8");
const login = readFileSync(resolve("app/(auth)/login/page.js"), "utf8");
const portalLogin = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");
const proxy = readFileSync(resolve("proxy.js"), "utf8");

test("successful registration navigates to /applicant/verify-email", () => {
  assert.match(register, /router\.push\(`\/applicant\/verify-email\?\$\{q\.toString\(\)\}`\)/);
  assert.match(register, /registered:\s*"1"/);
  assert.match(register, /ksp_verify_email/);
});

test("registration confirmation link targets callback next=/login", () => {
  assert.match(register, /auth\/callback\?next=\/login/);
  assert.doesNotMatch(register, /auth\/callback\?next=\/applicant(?!\/)/);
});

test("verify-email page is Check your email with resend + Back to Sign In", () => {
  assert.match(verify, /Check your email/);
  assert.match(verify, /verify your account before signing in/i);
  assert.match(verify, /Resend verification email/);
  assert.match(verify, /cooldownSec/);
  assert.match(verify, /Back to Sign In/);
  assert.match(verify, /auth\/callback\?next=\/login/);
  assert.doesNotMatch(verify, /router\.replace\("\/applicant"\)/);
  assert.doesNotMatch(verify, /router\.push\("\/applicant"\)/);
});

test("verification callback exchanges code, signs out, redirects to /login?verified=true", () => {
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /await supabase\.auth\.signOut\(\)/);
  assert.match(callback, /\/login\?verified=true/);
  assert.match(callback, /isApplicantEmailVerificationNext/);
});

test("callback preserves password recovery session path", () => {
  assert.match(callback, /\/reset-password/);
  assert.doesNotMatch(
    callback,
    /reset-password[\s\S]{0,200}signOut/
  );
});

test("login?verified=true shows display-only success banner", () => {
  assert.match(login, /verified/);
  assert.match(login, /Email verified successfully\. You can now sign in/);
  assert.match(login, /Display-only/);
  assert.doesNotMatch(login, /signInWithPassword/);
});

test("unverified login shows verification-specific error and resend", () => {
  assert.match(
    portalLogin,
    /Please verify your email before signing in\. Check your inbox for the verification link\./
  );
  assert.match(portalLogin, /email_not_confirmed/);
  assert.match(portalLogin, /Resend verification email/);
  assert.match(portalLogin, /needsVerification/);
  assert.doesNotMatch(portalLogin, /Invalid login credentials/);
});

test("verified applicant login still uses password and portal home", () => {
  assert.match(portalLogin, /signInWithPassword/);
  assert.match(portalLogin, /portalHomeForRole\(role\)/);
  assert.match(portalLogin, /email_confirmed_at == null/);
});

test("proxy allows verify-email without session and blocks unverified /applicant", () => {
  assert.match(proxy, /verifyEmailPath/);
  assert.match(proxy, /!verifyEmailPath/);
  assert.match(proxy, /applicantNeedsEmailVerification/);
  assert.match(proxy, /\/applicant\/verify-email/);
});
