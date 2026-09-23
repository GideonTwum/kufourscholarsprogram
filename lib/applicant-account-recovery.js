/**
 * Self-service applicant account recovery — identity match + secure email recovery.
 *
 * For current programme applicants only (profiles.role === "applicant").
 * The `scholar` role is intentionally excluded: scholars are accepted alumni of the
 * application process and are not the audience for Applicant Account Recovery.
 *
 * Matching email + name + phone is NOT sufficient to create a portal session.
 * After a successful match we trigger exactly one existing Supabase email flow:
 *   - unverified → verification resend only
 *   - verified   → password-reset email only
 * Tokens are never returned to the client.
 */

import { isValidEmailFormat, passwordResetCallbackUrl } from "./auth-recovery.js";
import { applicantEmailConfirmRedirectTo } from "./auth-email-confirm.js";

export const ACCOUNT_RECOVERY_SUCCESS_MESSAGE =
  "We've sent instructions to the email address associated with your application. Please check your inbox and spam folder.";

export const ACCOUNT_RECOVERY_FAILURE_MESSAGE =
  "We could not complete the recovery request with the information provided. Please check your details and try again.";

export const ACCOUNT_RECOVERY_RATE_LIMIT_MESSAGE =
  "Please wait before trying again.";

/**
 * Applicant Account Recovery eligibility — current applicants only.
 * Does not use isApplicantRole() (which also includes scholar).
 * @param {string|null|undefined} role
 */
export function isAccountRecoveryEligibleRole(role) {
  return role === "applicant";
}

/**
 * In-memory consumeRateLimit buckets are per-process (not shared across
 * Vercel/serverless isolates). Prefer Supabase Auth rate limits as the
 * authoritative control on actual outbound auth emails. This app-level
 * limit still blocks rapid identity guessing on a single warm instance.
 */
export const ACCOUNT_RECOVERY_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 5,
};

/**
 * Lightweight non-cryptographic bucket key — avoid logging raw emails.
 * @param {string} email
 */
export function hashEmailForRateLimit(email) {
  let h = 0;
  const s = String(email || "").toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `e${h.toString(16)}`;
}

/**
 * @param {string|null|undefined} email
 * @returns {string}
 */
export function normalizeRecoveryEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Conservative name normalization for exact comparison after formatting cleanup.
 * Does not fuzzy-match or drop name components.
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function normalizeRecoveryName(name) {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Digits only (for phone comparison).
 * @param {string|null|undefined} phone
 * @returns {string}
 */
export function phoneDigitsOnly(phone) {
  if (typeof phone !== "string" && typeof phone !== "number") return "";
  return String(phone).replace(/\D/g, "");
}

/**
 * Canonical phone string for comparison only (does not rewrite stored values).
 *
 * Ghana local forms (024… / +23324… / 23324…) normalize to the same 233… digit form.
 * Other international numbers compare on digits only (leading 0 / + stripped via digits).
 *
 * @param {string|null|undefined} phone
 * @returns {string|null} canonical digits, or null if empty/invalid
 */
export function normalizePhoneForCompare(phone) {
  let digits = phoneDigitsOnly(phone);
  if (!digits) return null;

  // Ghana national format: 0XXXXXXXXX (10 digits)
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `233${digits.slice(1)}`;
  }

  // Strip a single leading trunk-style 00 international prefix if present
  if (digits.startsWith("00") && digits.length > 4) {
    digits = digits.slice(2);
  }

  return digits;
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function phonesMatchForRecovery(a, b) {
  const na = normalizePhoneForCompare(a);
  const nb = normalizePhoneForCompare(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
export function namesMatchForRecovery(a, b) {
  const na = normalizeRecoveryName(a);
  const nb = normalizeRecoveryName(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Collect candidate identity fields from profile + optional application (same user).
 * @param {{ full_name?: string|null, phone?: string|null }|null} profile
 * @param {{ full_name?: string|null, phone?: string|null }|null} application
 */
export function collectApplicantIdentityCandidates(profile, application) {
  const names = [];
  const phones = [];
  const pushUnique = (arr, value) => {
    if (typeof value !== "string") return;
    const t = value.trim();
    if (!t) return;
    if (!arr.includes(t)) arr.push(t);
  };
  pushUnique(names, profile?.full_name);
  pushUnique(names, application?.full_name);
  pushUnique(phones, profile?.phone);
  pushUnique(phones, application?.phone);
  return { names, phones };
}

/**
 * Pure match evaluation — no I/O. Safe for unit tests.
 *
 * @param {{
 *   profile: { id?: string, email?: string, full_name?: string|null, phone?: string|null, role?: string|null }|null,
 *   application: { user_id?: string, full_name?: string|null, phone?: string|null, status?: string|null }|null,
 *   email: string,
 *   fullName: string,
 *   phone: string,
 * }} input
 * @returns {{ matched: boolean, code: string }}
 */
export function evaluateApplicantRecoveryMatch(input) {
  const email = normalizeRecoveryEmail(input?.email);
  const fullName = typeof input?.fullName === "string" ? input.fullName : "";
  const phone = typeof input?.phone === "string" ? input.phone : "";

  if (!isValidEmailFormat(email)) {
    return { matched: false, code: "invalid_email" };
  }
  if (!normalizeRecoveryName(fullName)) {
    return { matched: false, code: "invalid_name" };
  }
  if (!normalizePhoneForCompare(phone)) {
    return { matched: false, code: "invalid_phone" };
  }

  const profile = input?.profile;
  if (!profile?.id) {
    return { matched: false, code: "no_profile" };
  }

  // Server-side eligibility: current applicants only (not scholar / staff).
  if (!isAccountRecoveryEligibleRole(profile.role)) {
    return { matched: false, code: "role_rejected" };
  }

  const profileEmail = normalizeRecoveryEmail(profile.email);
  if (!profileEmail || profileEmail !== email) {
    return { matched: false, code: "email_mismatch" };
  }

  const application = input?.application || null;
  if (application?.user_id && application.user_id !== profile.id) {
    return { matched: false, code: "ownership_mismatch" };
  }

  const { names, phones } = collectApplicantIdentityCandidates(profile, application);

  const nameOk = names.some((n) => namesMatchForRecovery(n, fullName));
  if (!nameOk) {
    return { matched: false, code: "name_mismatch" };
  }

  const phoneOk = phones.some((p) => phonesMatchForRecovery(p, phone));
  if (!phoneOk) {
    return { matched: false, code: "phone_mismatch" };
  }

  return { matched: true, code: "match" };
}

/**
 * Which outbound auth email to send after a successful match.
 * Never sends both. Never sends any email when not matched (caller must gate).
 * @param {boolean} emailConfirmed
 * @returns {'verification_resend'|'password_reset'}
 */
export function selectRecoveryEmailAction(emailConfirmed) {
  return emailConfirmed ? "password_reset" : "verification_resend";
}

/**
 * Safe server log for recovery outcomes (no phones, tokens, or secrets).
 * @param {string} event
 * @param {Record<string, unknown>} [meta]
 */
export function logApplicantRecoveryEvent(event, meta = {}) {
  const safe = {
    event,
    emailHash: meta.emailHash ?? null,
    code: meta.code ?? null,
    role: meta.role ?? null,
    emailConfirmed: meta.emailConfirmed ?? null,
    emailAction: meta.emailAction ?? null,
    profileIdPresent: Boolean(meta.profileIdPresent),
    applicationIdPresent: Boolean(meta.applicationIdPresent),
    message: typeof meta.message === "string" ? meta.message.slice(0, 120) : null,
  };
  console.info("[account-recovery]", safe);
}

/**
 * After a successful identity match: trigger exactly one existing Supabase email path.
 * Does NOT create a session, return tokens, or force-confirm email.
 *
 * Unverified → verification resend only (applicant keeps existing password).
 * Verified   → password-reset email only.
 *
 * Redirect bases prefer NEXT_PUBLIC_SITE_URL (production:
 * https://www.kufuorscholarapplication.com) via existing helpers.
 *
 * @param {{
 *   supabase: { auth: { resetPasswordForEmail: Function, resend: Function } },
 *   email: string,
 *   emailConfirmed: boolean,
 *   originFallback?: string,
 * }} args
 * @returns {Promise<{ passwordResetTriggered: boolean, verificationResendTriggered: boolean, action: string }>}
 */
export async function initiateMatchedApplicantRecovery(args) {
  const email = normalizeRecoveryEmail(args.email);
  const origin = args.originFallback || "";
  const action = selectRecoveryEmailAction(Boolean(args.emailConfirmed));
  let passwordResetTriggered = false;
  let verificationResendTriggered = false;

  if (action === "password_reset") {
    try {
      const redirectTo = passwordResetCallbackUrl(origin);
      await args.supabase.auth.resetPasswordForEmail(email, { redirectTo });
      passwordResetTriggered = true;
    } catch {
      // swallowed — public response stays generic
    }
  } else {
    try {
      await args.supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: applicantEmailConfirmRedirectTo(origin),
        },
      });
      verificationResendTriggered = true;
    } catch {
      // swallowed
    }
  }

  return { passwordResetTriggered, verificationResendTriggered, action };
}

/**
 * Public response body helpers — never include tokens or account details.
 * Failure and success shapes both expose only `message` (plus rate-limit fields on 429).
 */
export function recoverySuccessBody() {
  return { message: ACCOUNT_RECOVERY_SUCCESS_MESSAGE };
}

export function recoveryFailureBody() {
  return { message: ACCOUNT_RECOVERY_FAILURE_MESSAGE };
}

export function recoveryRateLimitedBody(retryAfterSec) {
  return {
    error: "rate_limited",
    retryAfterSec: Number(retryAfterSec) || 60,
    message: ACCOUNT_RECOVERY_RATE_LIMIT_MESSAGE,
  };
}
