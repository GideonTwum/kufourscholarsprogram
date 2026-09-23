import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACCOUNT_RECOVERY_FAILURE_MESSAGE,
  ACCOUNT_RECOVERY_RATE_LIMIT,
  ACCOUNT_RECOVERY_SUCCESS_MESSAGE,
  collectApplicantIdentityCandidates,
  evaluateApplicantRecoveryMatch,
  hashEmailForRateLimit,
  initiateMatchedApplicantRecovery,
  isAccountRecoveryEligibleRole,
  namesMatchForRecovery,
  normalizePhoneForCompare,
  normalizeRecoveryEmail,
  normalizeRecoveryName,
  phonesMatchForRecovery,
  recoveryFailureBody,
  recoveryRateLimitedBody,
  recoverySuccessBody,
  selectRecoveryEmailAction,
} from "../lib/applicant-account-recovery.js";
import { consumeRateLimit, __resetRateLimitBucketsForTests } from "../lib/auth-rate-limit.js";
import { authRouteBouncePath } from "../lib/portal-auth.js";
import { passwordResetCallbackUrl, getPublicSiteUrl } from "../lib/auth-recovery.js";
import { applicantEmailConfirmRedirectTo } from "../lib/auth-email-confirm.js";

const recoveryLib = resolve("lib/applicant-account-recovery.js");
const recoveryApi = resolve("app/api/auth/account-recovery/route.js");
const recoveryPage = resolve("app/(auth)/account-recovery/page.js");
const proxyPath = resolve("proxy.js");
const loginFormPath = resolve("components/auth/PortalLoginForm.jsx");
const rateLimitPath = resolve("lib/auth-rate-limit.js");
const adminPath = resolve("lib/supabase/admin.js");

const APPLICANT_PROFILE = {
  id: "user-aaa",
  email: "juliana@example.com",
  full_name: "Juliana Adenkia",
  phone: "+233241234567",
  role: "applicant",
};

const APPLICATION = {
  id: "app-1",
  user_id: "user-aaa",
  full_name: "Juliana Adenkia",
  phone: "0241234567",
  status: "draft",
};

function matchInput(overrides = {}) {
  return {
    profile: APPLICANT_PROFILE,
    application: APPLICATION,
    email: "juliana@example.com",
    fullName: "Juliana Adenkia",
    phone: "0241234567",
    ...overrides,
  };
}

test("account recovery page and API exist", () => {
  assert.equal(existsSync(recoveryPage), true);
  assert.equal(existsSync(recoveryApi), true);
  assert.equal(existsSync(recoveryLib), true);
});

test("email normalization trims and lowercases only", () => {
  assert.equal(normalizeRecoveryEmail("  JuLiAna@Example.COM "), "juliana@example.com");
});

test("name normalization allows spacing and case differences only", () => {
  assert.equal(normalizeRecoveryName("  Juliana   Adenkia "), "juliana adenkia");
  assert.equal(namesMatchForRecovery("Juliana Adenkia", "juliana adenkia"), true);
  assert.equal(namesMatchForRecovery("Juliana Adenkia", "Juliana"), false);
});

test("Ghana phone forms normalize equivalently for comparison", () => {
  assert.equal(phonesMatchForRecovery("0241234567", "+233241234567"), true);
  assert.equal(phonesMatchForRecovery("0241234567", "233241234567"), true);
  assert.equal(normalizePhoneForCompare("+14155552671"), "14155552671");
});

test("eligibility helper allows only applicant", () => {
  assert.equal(isAccountRecoveryEligibleRole("applicant"), true);
  assert.equal(isAccountRecoveryEligibleRole("scholar"), false);
  assert.equal(isAccountRecoveryEligibleRole("director"), false);
  assert.equal(isAccountRecoveryEligibleRole("assessor"), false);
  assert.equal(isAccountRecoveryEligibleRole("panel"), false);
  assert.equal(isAccountRecoveryEligibleRole(null), false);
});

test("applicant role is eligible for matching", () => {
  const result = evaluateApplicantRecoveryMatch(matchInput());
  assert.equal(result.matched, true);
  assert.equal(result.code, "match");
});

test("scholar role is rejected for account recovery", () => {
  const result = evaluateApplicantRecoveryMatch(
    matchInput({ profile: { ...APPLICANT_PROFILE, role: "scholar" } })
  );
  assert.equal(result.matched, false);
  assert.equal(result.code, "role_rejected");
  assert.equal(recoveryFailureBody().message, ACCOUNT_RECOVERY_FAILURE_MESSAGE);
  assert.ok(!String(recoveryFailureBody().message).toLowerCase().includes("scholar"));
  assert.ok(!String(recoveryFailureBody().message).toLowerCase().includes("role"));
});

test("director / assessor / panel roles are rejected", () => {
  for (const role of ["director", "assessor", "panel"]) {
    const result = evaluateApplicantRecoveryMatch(
      matchInput({ profile: { ...APPLICANT_PROFILE, role } })
    );
    assert.equal(result.matched, false, role);
    assert.equal(result.code, "role_rejected", role);
  }
});

test("incorrect email / name / phone fail without field-specific public message", () => {
  assert.equal(
    evaluateApplicantRecoveryMatch(matchInput({ profile: null })).matched,
    false
  );
  assert.equal(
    evaluateApplicantRecoveryMatch(matchInput({ fullName: "Wrong Person" })).code,
    "name_mismatch"
  );
  assert.equal(
    evaluateApplicantRecoveryMatch(matchInput({ phone: "0249999999" })).code,
    "phone_mismatch"
  );
  assert.equal(recoveryFailureBody().message, ACCOUNT_RECOVERY_FAILURE_MESSAGE);
});

test("mismatched application ownership fails", () => {
  const result = evaluateApplicantRecoveryMatch(
    matchInput({
      application: { ...APPLICATION, user_id: "user-bbb", full_name: "Other Person" },
      fullName: "Other Person",
    })
  );
  assert.equal(result.matched, false);
  assert.equal(result.code, "ownership_mismatch");
});

test("selectRecoveryEmailAction is state-aware and exclusive", () => {
  assert.equal(selectRecoveryEmailAction(false), "verification_resend");
  assert.equal(selectRecoveryEmailAction(true), "password_reset");
});

test("unverified match triggers verification resend only (no password reset)", async () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  const calls = { reset: 0, resend: 0 };
  const supabase = {
    auth: {
      async resetPasswordForEmail() {
        calls.reset += 1;
        return { data: {}, error: null };
      },
      async resend(args) {
        calls.resend += 1;
        assert.equal(args.type, "signup");
        assert.equal(args.email, "juliana@example.com");
        return { data: {}, error: null };
      },
    },
  };

  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.kufuorscholarapplication.com";
    const result = await initiateMatchedApplicantRecovery({
      supabase,
      email: "Juliana@Example.com",
      emailConfirmed: false,
      originFallback: "https://www.kufuorscholarapplication.com",
    });
    assert.equal(result.action, "verification_resend");
    assert.equal(result.verificationResendTriggered, true);
    assert.equal(result.passwordResetTriggered, false);
    assert.equal(calls.resend, 1);
    assert.equal(calls.reset, 0);
  } finally {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
});

test("verified match triggers password reset only (no verification resend)", async () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  const calls = { reset: 0, resend: 0 };
  const supabase = {
    auth: {
      async resetPasswordForEmail(email, opts) {
        calls.reset += 1;
        assert.equal(email, "juliana@example.com");
        assert.match(opts.redirectTo, /\/auth\/callback/);
        assert.match(opts.redirectTo, /reset-password/);
        return { data: {}, error: null };
      },
      async resend() {
        calls.resend += 1;
        return { data: {}, error: null };
      },
    },
  };

  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.kufuorscholarapplication.com";
    const result = await initiateMatchedApplicantRecovery({
      supabase,
      email: "juliana@example.com",
      emailConfirmed: true,
      originFallback: "https://www.kufuorscholarapplication.com",
    });
    assert.equal(result.action, "password_reset");
    assert.equal(result.passwordResetTriggered, true);
    assert.equal(result.verificationResendTriggered, false);
    assert.equal(calls.reset, 1);
    assert.equal(calls.resend, 0);
  } finally {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
});

test("rejected match paths never initiate email actions", async () => {
  const rejected = [
    evaluateApplicantRecoveryMatch(matchInput({ profile: null })),
    evaluateApplicantRecoveryMatch(matchInput({ fullName: "Nope" })),
    evaluateApplicantRecoveryMatch(matchInput({ phone: "0200000000" })),
    evaluateApplicantRecoveryMatch(
      matchInput({ profile: { ...APPLICANT_PROFILE, role: "scholar" } })
    ),
    evaluateApplicantRecoveryMatch(
      matchInput({ profile: { ...APPLICANT_PROFILE, role: "director" } })
    ),
  ];
  for (const r of rejected) {
    assert.equal(r.matched, false);
  }

  // API gates email initiation behind a successful match (no email on reject).
  const api = readFileSync(recoveryApi, "utf8");
  assert.match(
    api,
    /if\s*\(\s*!evaluation\.matched\s*\)[\s\S]*?return NextResponse\.json\(recoveryFailureBody\(\)\)/
  );
  assert.match(api, /await initiateMatchedApplicantRecovery\(/);
  // Ensure failure return appears before the initiate call in the handler body.
  const handlerStart = api.indexOf("export async function POST");
  const failReturn = api.indexOf("return NextResponse.json(recoveryFailureBody())", handlerStart);
  const initiateCall = api.indexOf("await initiateMatchedApplicantRecovery(", handlerStart);
  assert.ok(handlerStart >= 0 && failReturn >= 0 && initiateCall >= 0);
  assert.ok(failReturn < initiateCall);
});

test("public responses do not leak field, role, UUID, status, or tokens", () => {
  assert.equal(recoverySuccessBody().message, ACCOUNT_RECOVERY_SUCCESS_MESSAGE);
  assert.equal(recoveryFailureBody().message, ACCOUNT_RECOVERY_FAILURE_MESSAGE);
  assert.match(ACCOUNT_RECOVERY_SUCCESS_MESSAGE, /inbox and spam folder/i);
  for (const body of [recoverySuccessBody(), recoveryFailureBody()]) {
    assert.deepEqual(Object.keys(body).sort(), ["message"]);
    assert.ok(!("access_token" in body));
    assert.ok(!("refresh_token" in body));
    assert.ok(!("user" in body));
    assert.ok(!("role" in body));
    assert.ok(!("profileId" in body));
    assert.ok(!("status" in body));
  }
  assert.ok(!ACCOUNT_RECOVERY_FAILURE_MESSAGE.toLowerCase().includes("phone"));
  assert.ok(!ACCOUNT_RECOVERY_FAILURE_MESSAGE.toLowerCase().includes("scholar"));
  assert.ok(!ACCOUNT_RECOVERY_SUCCESS_MESSAGE.toLowerCase().includes("draft"));
  assert.ok(!ACCOUNT_RECOVERY_SUCCESS_MESSAGE.toLowerCase().includes("verified"));
});

test("rate limit blocks repeated attempts on a warm instance", () => {
  __resetRateLimitBucketsForTests();
  const key = `recovery:${hashEmailForRateLimit("a@b.co")}:127.0.0.1`;
  for (let i = 0; i < ACCOUNT_RECOVERY_RATE_LIMIT.max; i++) {
    assert.equal(consumeRateLimit(key, ACCOUNT_RECOVERY_RATE_LIMIT).allowed, true);
  }
  const blocked = consumeRateLimit(key, ACCOUNT_RECOVERY_RATE_LIMIT);
  assert.equal(blocked.allowed, false);
  const rateSrc = readFileSync(rateLimitPath, "utf8");
  assert.match(rateSrc, /in-process|Best-effort in-process|buckets = new Map/i);
});

test("recovery redirects use NEXT_PUBLIC_SITE_URL helpers (no hardcoded localhost)", () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.kufuorscholarapplication.com";
    assert.equal(getPublicSiteUrl(), "https://www.kufuorscholarapplication.com");
    const reset = passwordResetCallbackUrl();
    assert.match(reset, /^https:\/\/www\.kufuorscholarapplication\.com\/auth\/callback/);
    assert.ok(reset.includes(encodeURIComponent("/reset-password")));
    const confirmBase = applicantEmailConfirmRedirectTo();
    assert.equal(confirmBase, "https://www.kufuorscholarapplication.com");
    const lib = readFileSync(recoveryLib, "utf8");
    assert.doesNotMatch(lib, /localhost:3000/);
    assert.doesNotMatch(lib, /http:\/\/127\.0\.0\.1/);
  } finally {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  }
});

test("API uses existing env-backed clients; no new env vars; no mutations", () => {
  const src = readFileSync(recoveryApi, "utf8");
  const admin = readFileSync(adminPath, "utf8");
  assert.match(src, /createAdminClient/);
  assert.match(admin, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(admin, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(src, /process\.env\.[A-Z0-9_]*RECOVERY/);
  assert.doesNotMatch(src, /createUser/);
  assert.doesNotMatch(src, /deleteUser/);
  assert.doesNotMatch(src, /email_confirm:\s*true/);
  assert.doesNotMatch(src, /\.insert\(/);
  assert.doesNotMatch(src, /\.update\(/);
  assert.doesNotMatch(src, /\.delete\(/);
});

test("recovery page copy and links stay applicant-facing", () => {
  const src = readFileSync(recoveryPage, "utf8");
  assert.match(src, /Applicant Account Recovery/);
  assert.match(src, /ACCOUNT_RECOVERY_SUCCESS_MESSAGE/);
  assert.match(src, /\/forgot-password\?portal=applicant/);
  assert.match(src, /\/applicant\/verify-email/);
  assert.doesNotMatch(src, /createAdminClient/);
});

test("proxy treats account-recovery as public auth route", () => {
  assert.match(readFileSync(proxyPath, "utf8"), /\/account-recovery/);
  assert.equal(authRouteBouncePath("/account-recovery", "applicant"), null);
});

test("applicant login links to account recovery", () => {
  const src = readFileSync(loginFormPath, "utf8");
  assert.match(src, /\/account-recovery/);
  assert.match(src, /expectedRole === "applicant"/);
});

test("helpers never mint sessions or create duplicate accounts", () => {
  const lib = readFileSync(recoveryLib, "utf8");
  assert.doesNotMatch(lib, /createUser/);
  assert.doesNotMatch(lib, /signInWithPassword/);
  assert.doesNotMatch(lib, /exchangeCodeForSession/);
  assert.match(lib, /isAccountRecoveryEligibleRole/);
  assert.match(lib, /role === "applicant"/);
});

test("name/phone can match from application when profile phone empty", () => {
  const result = evaluateApplicantRecoveryMatch(
    matchInput({
      profile: { ...APPLICANT_PROFILE, phone: null },
      application: { ...APPLICATION, phone: "0241234567" },
      phone: "+233241234567",
    })
  );
  assert.equal(result.matched, true);
  const candidates = collectApplicantIdentityCandidates(
    { full_name: "A", phone: null },
    { full_name: "B", phone: "0241" }
  );
  assert.deepEqual(candidates.names, ["A", "B"]);
});

test("case-insensitive email match still works for applicants", () => {
  assert.equal(
    evaluateApplicantRecoveryMatch(matchInput({ email: "JULIANA@EXAMPLE.COM" })).matched,
    true
  );
});

test("rate-limited body shape does not reveal account data", () => {
  const body = recoveryRateLimitedBody(42);
  assert.equal(body.error, "rate_limited");
  assert.equal(body.retryAfterSec, 42);
  assert.ok(!JSON.stringify(body).includes("juliana"));
  assert.ok(!JSON.stringify(body).includes("user-aaa"));
});
