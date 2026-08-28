/**
 * Applicant email confirmation helpers (token_hash / verifyOtp).
 * Cross-browser safe — does not require PKCE code_verifier from signup browser.
 */

import { getPublicSiteUrl } from "./auth-recovery.js";

/** OTP types accepted for Confirm signup / email verification. */
export const EMAIL_CONFIRM_OTP_TYPES = ["email", "signup"];

/**
 * @param {string|null|undefined} type
 * @returns {boolean}
 */
export function isEmailConfirmOtpType(type) {
  return EMAIL_CONFIRM_OTP_TYPES.includes(String(type || "").trim().toLowerCase());
}

/**
 * Normalize OTP type for verifyOtp.
 * @param {string|null|undefined} type
 * @returns {'email'|'signup'|null}
 */
export function normalizeEmailConfirmOtpType(type) {
  const t = String(type || "").trim().toLowerCase();
  if (t === "email" || t === "signup") return t;
  return null;
}

/**
 * Canonical post-confirm login URL (display-only success flag).
 * @param {string} origin
 */
export function verifiedLoginPath(origin) {
  return `${String(origin || "").replace(/\/$/, "")}/login?verified=true`;
}

/**
 * Safe failure redirect — never includes raw provider errors.
 * @param {string} origin
 */
export function verificationErrorLoginPath(origin) {
  return `${String(origin || "").replace(/\/$/, "")}/login?verification_error=1`;
}

/**
 * Production-safe applicant confirmation redirect base (no query).
 * Prefers NEXT_PUBLIC_SITE_URL; falls back to provided origin (browser).
 * @param {string} [originFallback]
 */
export function applicantEmailConfirmBaseUrl(originFallback = "") {
  const base =
    getPublicSiteUrl() || String(originFallback || "").trim().replace(/\/$/, "");
  return base ? `${base}/auth/confirm` : "/auth/confirm";
}

/**
 * emailRedirectTo for signUp / resend.
 *
 * IMPORTANT: With the TokenHash Confirm signup template, the email link goes to
 * /auth/confirm via {{ .TokenHash }} — not this redirect_to value.
 * Supabase still validates emailRedirectTo against the redirect allowlist.
 * Use the Site URL origin (always allowed) so signup does not fail when
 * /auth/confirm has not yet been added as an Additional Redirect URL.
 *
 * @param {string} [originFallback]
 */
export function applicantEmailConfirmRedirectTo(originFallback = "") {
  const base =
    getPublicSiteUrl() || String(originFallback || "").trim().replace(/\/$/, "");
  return base || "/";
}


/**
 * Safe server log for verification outcomes (no tokens/secrets).
 * @param {'verify_ok'|'verify_failed'|'verify_rejected'} event
 * @param {{ method?: string, type?: string|null, code?: string|null, message?: string|null }} [meta]
 */
export function logEmailVerificationEvent(event, meta = {}) {
  const payload = {
    event,
    method: meta.method || "token_hash",
    type: meta.type || null,
    code: meta.code || null,
    message: meta.message ? String(meta.message).slice(0, 200) : null,
    ts: new Date().toISOString(),
  };
  if (event === "verify_ok") {
    console.info("[auth/confirm]", payload);
  } else {
    console.error("[auth/confirm]", payload);
  }
}
