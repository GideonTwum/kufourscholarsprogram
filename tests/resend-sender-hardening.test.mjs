import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getEmailConfig,
  isValidEmailFrom,
  SANDBOX_FALLBACK_FROM,
  EMAIL_FROM_MISSING,
  EMAIL_FROM_INVALID,
  classifyEmailFromDomain,
  getSafeEmailErrorMessage,
  __resetEmailConfigWarningFlagForTests,
} from "../lib/email/config.js";
import { buildAuthEmailHealth } from "../lib/auth-email-health.js";

const PROD_FROM =
  "Kufuor Scholars Program <noreply@kufuorscholarapplication.com>";

test("isValidEmailFrom accepts bare email and display-name form", () => {
  assert.equal(isValidEmailFrom("noreply@example.com"), true);
  assert.equal(isValidEmailFrom(PROD_FROM), true);
  assert.equal(isValidEmailFrom("not-an-email"), false);
  assert.equal(isValidEmailFrom("Name only"), false);
  assert.equal(isValidEmailFrom(""), false);
});

test("production with missing EMAIL_FROM fails closed", () => {
  const cfg = getEmailConfig({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "",
  });
  assert.equal(cfg.canSend, false);
  assert.equal(cfg.emailFrom, null);
  assert.equal(cfg.fromError, EMAIL_FROM_MISSING);
  assert.equal(cfg.usingDevFallbackFrom, false);
  assert.equal(String(cfg.emailFrom || "").includes("onboarding@resend.dev"), false);
});

test("production never silently uses onboarding@resend.dev", () => {
  const missing = getEmailConfig({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test",
  });
  assert.notEqual(missing.emailFrom, SANDBOX_FALLBACK_FROM);

  const explicitSandbox = getEmailConfig({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: SANDBOX_FALLBACK_FROM,
  });
  assert.equal(explicitSandbox.canSend, false);
  assert.equal(explicitSandbox.fromError, EMAIL_FROM_INVALID);
  assert.equal(explicitSandbox.emailFrom, null);
});

test("development may use sandbox fallback with Program display name", () => {
  const cfg = getEmailConfig({
    NODE_ENV: "development",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "",
  });
  assert.equal(cfg.canSend, true);
  assert.equal(cfg.usingDevFallbackFrom, true);
  assert.equal(cfg.sandboxSenderInUse, true);
  assert.equal(cfg.emailFrom, SANDBOX_FALLBACK_FROM);
  assert.match(cfg.emailFrom, /^Kufuor Scholars Program </);
  assert.match(cfg.emailFrom, /onboarding@resend\.dev/);
});

test("configured production sender is used unchanged", () => {
  const cfg = getEmailConfig({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: PROD_FROM,
    NEXT_PUBLIC_SITE_URL: "https://scholars.example.com",
  });
  assert.equal(cfg.canSend, true);
  assert.equal(cfg.emailFrom, PROD_FROM);
  assert.equal(cfg.fromError, null);
  assert.equal(cfg.emailFromDomainClass, "production_verified_domain");
  assert.equal(cfg.isProductionReady, true);
});

test("invalid EMAIL_FROM yields EMAIL_FROM_INVALID", () => {
  const cfg = getEmailConfig({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "Not A Valid From",
  });
  assert.equal(cfg.fromError, EMAIL_FROM_INVALID);
  assert.equal(cfg.canSend, false);
});

test("Edge Function requires EMAIL_FROM unless sandbox flag", () => {
  const src = readFileSync(resolve("supabase/functions/send-email/index.ts"), "utf8");
  assert.match(src, /ALLOW_RESEND_SANDBOX_FALLBACK/);
  assert.match(src, /EMAIL_FROM_MISSING/);
  assert.match(src, /EMAIL_FROM_INVALID/);
  assert.match(src, /Kufuor Scholars Program <onboarding@resend\.dev>/);
  assert.doesNotMatch(src, /Kufuor Scholars <onboarding@resend\.dev>/);
  assert.match(src, /resolveEmailFrom/);
});

test("health endpoint reports sandbox usage without exposing sender value", () => {
  __resetEmailConfigWarningFlagForTests();
  const prev = { ...process.env };
  try {
    process.env.NODE_ENV = "development";
    process.env.RESEND_API_KEY = "re_test_secret_value_do_not_leak";
    delete process.env.EMAIL_FROM;
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOi.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";

    const health = buildAuthEmailHealth({ requestHost: "localhost:3000" });
    const serialized = JSON.stringify(health);
    assert.equal(health.email_from, "missing");
    assert.equal(health.sandbox_sender_in_use, true);
    assert.equal(health.email_from_domain, "sandbox");
    assert.equal(serialized.includes("re_test_secret"), false);
    assert.equal(serialized.includes("service-role-secret"), false);
    assert.equal(serialized.includes("onboarding@resend.dev"), false);
    assert.equal(serialized.includes("noreply@"), false);
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k];
    }
    Object.assign(process.env, prev);
  }
});

test("health classifies production domain without returning full EMAIL_FROM", () => {
  const prev = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_prod";
    process.env.EMAIL_FROM = PROD_FROM;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";

    const health = buildAuthEmailHealth({ requestHost: "app.example.com" });
    assert.equal(health.email_from, "configured");
    assert.equal(health.email_from_domain, "production_verified_domain");
    assert.equal(health.sandbox_sender_in_use, false);
    assert.equal(JSON.stringify(health).includes("noreply@kufuorscholarapplication.com"), false);
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in prev)) delete process.env[k];
    }
    Object.assign(process.env, prev);
  }
});

test("no email route hardcodes Resend from", () => {
  const routes = [
    "app/api/applications/submit-stage1/route.js",
    "app/api/applications/submit-stage2/route.js",
    "app/api/applications/[id]/update-status/route.js",
    "app/api/interview-slots/route.js",
    "app/api/director/interview-slots/[id]/route.js",
    "app/api/director/email-panel/route.js",
    "app/api/director/email-test/route.js",
    "app/api/director/assessors/[id]/route.js",
    "app/api/director/assessor-assignments/route.js",
    "app/api/assessor/applications/[id]/route.js",
  ];
  for (const f of routes) {
    assert.equal(existsSync(resolve(f)), true, f);
    const src = readFileSync(resolve(f), "utf8");
    assert.doesNotMatch(src, /from:\s*['"`].*@/, f);
    assert.doesNotMatch(src, /onboarding@resend\.dev/, f);
  }
});

test("safe errors do not embed secrets", () => {
  const msg = getSafeEmailErrorMessage({
    message: "Bearer re_abc123XYZ failed with eyJhbGciOi.abc.def",
  });
  assert.match(msg, /REDACTED/);
  assert.equal(msg.includes("re_abc123XYZ"), false);
});

test("classifyEmailFromDomain", () => {
  assert.equal(classifyEmailFromDomain(PROD_FROM), "production_verified_domain");
  assert.equal(classifyEmailFromDomain(SANDBOX_FALLBACK_FROM), "sandbox");
  assert.equal(
    classifyEmailFromDomain("Kufuor Scholars Program <ops@other.org>"),
    "other_domain"
  );
});

test("docs document Edge EMAIL_FROM secret parity", () => {
  const docs = readFileSync(resolve("docs/AUTH-EMAIL-PRODUCTION-CONFIG.md"), "utf8");
  assert.match(docs, /supabase secrets set EMAIL_FROM/);
  assert.match(docs, /ALLOW_RESEND_SANDBOX_FALLBACK/);
  assert.match(docs, /kufuorscholarapplication\.com/);
  assert.match(docs, /Kufuor Scholars Program/);
});
