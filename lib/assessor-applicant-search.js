/**
 * Assessor applicant search — filters within an already assignment-scoped list.
 * Authorization remains on the assessor applications API (active assignment only).
 * Do not use this helper against an unscoped application population.
 */

/**
 * Normalize a raw search string: trim whitespace. Empty after trim → "".
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeAssessorSearchQuery(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

/**
 * Build a case-insensitive haystack from fields assessors already receive.
 * Includes student_id only because it is already in the assessor-safe payload.
 * @param {object} app — list item from GET /api/assessor/applications
 * @returns {string}
 */
export function assessorApplicantSearchHaystack(app) {
  if (!app || typeof app !== "object") return "";

  const fullName =
    app.application?.applicant?.full_name ||
    app.application?.full_name ||
    app.full_name ||
    app.profiles?.full_name ||
    "";

  const email =
    app.application?.applicant?.email ||
    app.profiles?.email ||
    app.email ||
    "";

  const university =
    app.application?.university ||
    app.university ||
    "";

  const studentId =
    app.application?.student_id ||
    app.student_id ||
    "";

  return [fullName, email, university, studentId]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
}

/**
 * Filter assigned applications by partial, case-insensitive match.
 * Empty / whitespace-only query returns the full assigned list unchanged.
 *
 * @param {object[]} applications — must already be scoped to this assessor
 * @param {unknown} query
 * @returns {object[]}
 */
export function filterAssessorApplicationsBySearch(applications, query) {
  const list = Array.isArray(applications) ? applications : [];
  const q = normalizeAssessorSearchQuery(query).toLowerCase();
  if (!q) return list;

  return list.filter((app) => assessorApplicantSearchHaystack(app).includes(q));
}
