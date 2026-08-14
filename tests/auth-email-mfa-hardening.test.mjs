import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { escapeHtml, escapeHtmlWithBreaks } from "../lib/email/escape.js";
import { buildAuthEmailHealth } from "../lib/auth-email-health.js";

test("escapeHtml escapes untrusted characters", () => {
  const raw = `<script>alert("x")</script>&'`;
  const out = escapeHtml(raw);
  assert.equal(out.includes("<script>"), false);
  assert.equal(out.includes("&lt;script&gt;"), true);
  assert.equal(out.includes("&amp;"), true);
  assert.equal(out.includes("&quot;"), true);
  assert.equal(out.includes("&#39;"), true);
});

test("escapeHtmlWithBreaks escapes before converting newlines", () => {
  const out = escapeHtmlWithBreaks("Hello\n<script>x</script>");
  assert.equal(out.includes("<br/>"), true);
  assert.equal(out.includes("<script>"), false);
  assert.equal(out.indexOf("&lt;script") > out.indexOf("Hello"), true);
});

test("panel broadcast escapes Director message", () => {
  const src = readFileSync(resolve("app/api/director/email-panel/route.js"), "utf8");
  assert.match(src, /escapeHtmlWithBreaks/);
  assert.equal(src.includes("message.trim().replace(/\\n/g"), false);
});

test("interview cancel/update and assessor emails escape names", () => {
  const cancel = readFileSync(resolve("app/api/director/interview-slots/[id]/route.js"), "utf8");
  assert.match(cancel, /escapeHtml\(name\)/);
  const assessor = readFileSync(resolve("app/api/assessor/applications/[id]/route.js"), "utf8");
  assert.match(assessor, /escapeHtml\(applicantLabel\)/);
  assert.match(assessor, /safeRec/);
});

test("stage2 submission uses shared escapeHtml", () => {
  const src = readFileSync(resolve("app/api/applications/submit-stage2/route.js"), "utf8");
  assert.match(src, /escapeHtml\(name\)/);
});

test("interview batch assign uses escapeHtmlWithBreaks for congratulations", () => {
  const src = readFileSync(resolve("app/api/interview-slots/route.js"), "utf8");
  assert.match(src, /escapeHtmlWithBreaks\(congratulations_message\)/);
});

test("lifecycle migration protects is_active and deactivation columns", () => {
  const path = resolve("supabase/migrations/202608060001_auth_mfa_lifecycle_hardening.sql");
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /is_active/);
  assert.match(sql, /deactivated_at/);
  assert.match(sql, /deactivated_by/);
  assert.match(sql, /service_role/);
  assert.doesNotMatch(sql, /p\.role = 'director'/);
  assert.equal(existsSync(resolve("docs/VERIFY-AUTH-LIFECYCLE-HARDENING.sql")), true);
});

test("auth-email-health never returns secret values", () => {
  process.env.RESEND_API_KEY = "re_test_secret_value_do_not_leak";
  process.env.EMAIL_FROM = "KSP <noreply@example.com>";
  process.env.NEXT_PUBLIC_SITE_URL = "https://scholars.example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOi.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
  process.env.NODE_ENV = "development";

  const health = buildAuthEmailHealth({ requestHost: "scholars.example.com" });
  const serialized = JSON.stringify(health);
  assert.equal(health.resend_api_key, "configured");
  assert.equal(health.service_role, "configured");
  assert.equal(health.email_from, "configured");
  assert.equal(health.mfa_required_for_director, false);
  assert.equal(serialized.includes("re_test_secret"), false);
  assert.equal(serialized.includes("service-role-secret"), false);
  assert.equal(serialized.includes("eyJhbGciOi.test"), false);
  assert.equal(serialized.includes("noreply@example.com"), false);
  assert.equal(existsSync(resolve("app/api/director/auth-email-health/route.js")), true);
  const route = readFileSync(resolve("app/api/director/auth-email-health/route.js"), "utf8");
  assert.match(route, /requireActiveDirector/);
});

test("dashboard logout uses portal-correct destinations", () => {
  const src = readFileSync(resolve("app/(dashboard)/layout.js"), "utf8");
  assert.match(src, /assessor-login/);
  assert.match(src, /panel-login/);
  assert.match(src, /director-login/);
});
