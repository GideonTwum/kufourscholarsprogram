/**
 * Four-portal auth helpers (client + server safe).
 * profiles.role is the only authorization source.
 */

import { isDirectorRole, dashboardPathForRole } from "./roles.js";

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

export function loginPathForRole(role) {
  return LOGIN_PATH_BY_ROLE[role] || "/login";
}

export function loginPathForProtectedRoute(pathname) {
  if (pathname.startsWith("/director")) return "/director-login";
  if (pathname.startsWith("/assessor")) return "/assessor-login";
  if (pathname.startsWith("/panel")) return "/panel-login";
  return "/login";
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
