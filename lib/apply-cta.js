/**
 * Shared public Apply CTA destinations.
 * Keep navbar / hero / footer / mobile in sync via these helpers.
 */

export const APPLY_REGISTER_HREF = "/applicant-register";
export const APPLY_PREP_HREF = "/apply";
export const STAFF_APPLY_NOTICE_HREF = "/?notice=staff-session";
export const STAFF_APPLY_NOTICE = "staff-session";

/**
 * Primary Apply Now destination when applications are open/closed.
 * Role-aware bounce for signed-in staff is handled in proxy via authRouteBouncePath.
 */
export function applyNowHref(applicationsOpen) {
  return applicationsOpen ? APPLY_REGISTER_HREF : APPLY_PREP_HREF;
}

export function applyNowLabel(applicationsOpen) {
  return applicationsOpen ? "Apply Now" : "Applications Closed";
}

export function isStaffApplyNotice(searchParams) {
  if (!searchParams) return false;
  const value =
    typeof searchParams.get === "function"
      ? searchParams.get("notice")
      : searchParams.notice;
  return value === STAFF_APPLY_NOTICE;
}
