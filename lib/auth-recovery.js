/**
 * Password recovery helpers — portal allowlist and safe redirect builders.
 */

import { loginPathForRole } from "./portal-auth.js";
import { safeAuthRedirectPath } from "./application-status-transition.mjs";

export const RECOVERY_PORTALS = ["applicant", "assessor", "panel", "director"];

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "If an account exists for this email, password reset instructions have been sent.";

/**
 * @param {string|null|undefined} portal
 * @returns {'applicant'|'assessor'|'panel'|'director'}
 */
export function normalizeRecoveryPortal(portal) {
  const p = typeof portal === "string" ? portal.trim().toLowerCase() : "";
  if (RECOVERY_PORTALS.includes(p)) return p;
  return "applicant";
}

export function loginPathForRecoveryPortal(portal) {
  return loginPathForRole(normalizeRecoveryPortal(portal));
}

/**
 * Production site URL without trailing slash.
 * Falls back to empty string when unset (caller may use window.location.origin).
 */
export function getPublicSiteUrl() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
}

/**
 * Safe recovery redirect used with resetPasswordForEmail.
 * @param {string} [originFallback]
 */
export function passwordResetCallbackUrl(originFallback = "") {
  const base = getPublicSiteUrl() || String(originFallback || "").replace(/\/$/, "");
  const next = safeAuthRedirectPath("/reset-password", "/reset-password");
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function isValidEmailFormat(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
