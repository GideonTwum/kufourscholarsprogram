/**
 * Four-portal auth helpers (client + server safe).
 * profiles.role is the only authorization source.
 */

import { isDirectorRole, dashboardPathForRole } from "./roles.js";
import { isDirectorMfaPath } from "./director-mfa.js";
import { safeAuthRedirectPath } from "./application-status-transition.mjs";
import { STAFF_APPLY_NOTICE } from "./apply-cta.js";

export const PORTAL_ROLES = ["applicant", "assessor", "panel", "director"];

export const LOGIN_PATH_BY_ROLE = {
  applicant: "/login",
  scholar: "/login",
  assessor: "/assessor-login",
  panel: "/panel-login",
  director: "/director-login",
};

export const PORTAL_LABEL = {
  applicant: "Applicant Portal",
  scholar: "Applicant Portal",
  assessor: "Assessor Portal",
  panel: "Panel Portal",
  director: "Director Portal",
};

/** Public Apply / register entry — must never funnel staff into Director MFA. */
export const APPLICANT_ENTRY_AUTH_PATHS = ["/applicant-register", "/register"];

export function loginPathForRole(role) {
  return LOGIN_PATH_BY_ROLE[role] || "/login";
}

export function loginPathForProtectedRoute(pathname) {
  if (pathname.startsWith("/director")) return "/director-login";
  if (pathname.startsWith("/assessor")) return "/assessor-login";
  if (pathname.startsWith("/panel")) return "/panel-login";
  return "/login";
}

export function isApplicantRole(role) {
  return role === "applicant" || role === "scholar";
}

export function isStaffPortalRole(role) {
  return isDirectorRole(role) || role === "assessor" || role === "panel";
}

export function isApplicantEntryAuthPath(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  return APPLICANT_ENTRY_AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Where a signed-in user should go when hitting an auth route.
 * Returns null to leave them on the current page (no redirect).
 *
 * Critical: staff on Apply/register must NOT bounce to /director (MFA).
 */
export function authRouteBouncePath(pathname, role) {
  if (!role) return null;

  if (pathname.startsWith("/forgot-password")) return null;

  if (isApplicantEntryAuthPath(pathname)) {
    if (isApplicantRole(role)) return dashboardPathForRole(role);
    // Staff Apply bounce: pathname only. Proxy adds ?notice=staff-session.
    if (isStaffPortalRole(role)) return "/";
    return null;
  }

  return dashboardPathForRole(role);
}

/** Extra search params when bouncing staff away from Apply/register. */
export function authRouteBounceSearchParams(pathname, role) {
  if (isApplicantEntryAuthPath(pathname) && isStaffPortalRole(role)) {
    return { notice: STAFF_APPLY_NOTICE };
  }
  return null;
}

/**
 * After OAuth/email callback: honor `next` only when it matches the user's portal.
 * Never send non-directors to Director MFA or /director/*.
 */
export function resolvePostAuthRedirect(role, requestedNext) {
  const fallback = role ? dashboardPathForRole(role) : "/applicant";
  const next = safeAuthRedirectPath(requestedNext, fallback);

  if (isDirectorMfaPath(next) || next === "/director" || next.startsWith("/director/")) {
    if (!isDirectorRole(role)) return fallback;
  }
  if (next === "/assessor" || next.startsWith("/assessor/")) {
    if (role !== "assessor") return fallback;
  }
  if (next === "/panel" || next.startsWith("/panel/")) {
    if (role !== "panel") return fallback;
  }
  if (next === "/applicant" || next.startsWith("/applicant/")) {
    if (isStaffPortalRole(role)) return fallback;
  }
  return next;
}

/**
 * @param {string|undefined} actualRole - from profiles.role
 * @param {string} expectedRole - portal this login page is for
 */
export function assertLoginPortalRole(actualRole, expectedRole) {
  if (!actualRole) {
    return {
      ok: false,
      message: "Your account profile could not be verified. Contact support.",
      redirectHint: "/login",
    };
  }

  if (expectedRole === "applicant" && (actualRole === "applicant" || actualRole === "scholar")) {
    return { ok: true };
  }

  if (expectedRole === "director" && isDirectorRole(actualRole)) {
    return { ok: true };
  }

  if (actualRole === expectedRole) {
    return { ok: true };
  }

  const label = PORTAL_LABEL[actualRole] || "another portal";
  const hint = loginPathForRole(actualRole);
  return {
    ok: false,
    message: `This account belongs to the ${label}. Please use the ${label.replace(" Portal", "")} login page.`,
    redirectHint: hint,
  };
}

export function portalHomeForRole(role) {
  return dashboardPathForRole(role);
}

export function isValidStaffCreateRole(role) {
  return role === "assessor" || role === "panel" || role === "director";
}
