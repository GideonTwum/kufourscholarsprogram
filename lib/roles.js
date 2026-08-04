/**
 * Launch-canonical staff role is "director".
 * Do not introduce administrator / super_administrator until a full coordinated migration.
 */

export const DIRECTOR_ROLE = "director";

export const STAFF_ROLES = ["director", "panel", "assessor"];

export function isDirectorRole(role) {
  return role === DIRECTOR_ROLE;
}

export function dashboardPathForRole(role) {
  if (isDirectorRole(role)) return "/director";
  if (role === "panel") return "/panel";
  if (role === "assessor") return "/assessor";
  return "/applicant";
}
