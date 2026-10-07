/**
 * Director Applications list ↔ detail return-context helpers.
 *
 * Carry filter/search state via `?returnTo=` on the detail URL.
 * Validate strictly to prevent open redirects.
 */

export const DIRECTOR_APPLICATIONS_LIST_PATH = "/director/applications";

export const DIRECTOR_APPLICATIONS_RETURN_PARAM = "returnTo";

/** Query keys allowed on the Applications list (and inside returnTo). */
export const DIRECTOR_APPLICATIONS_ALLOWED_QUERY_KEYS = [
  "status",
  "workflow",
  "stage",
  "assessor",
  "q",
];

const ALLOWED_QUERY_KEY_SET = new Set(DIRECTOR_APPLICATIONS_ALLOWED_QUERY_KEYS);

const MAX_QUERY_VALUE_LENGTH = 500;

/**
 * Build the canonical Applications list href from filter/search state.
 * Omits default "all" / empty values for clean URLs.
 *
 * @param {{
 *   status?: string,
 *   workflow?: string,
 *   stage?: string,
 *   assessor?: string,
 *   q?: string,
 * }} [filters]
 * @returns {string}
 */
export function buildDirectorApplicationsListHref({
  status = "",
  workflow = "all",
  stage = "all",
  assessor = "",
  q = "",
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", String(status));
  if (workflow && workflow !== "all") params.set("workflow", String(workflow));
  if (stage && stage !== "all") params.set("stage", String(stage));
  if (assessor) params.set("assessor", String(assessor));
  const search = typeof q === "string" ? q.trim() : "";
  if (search) params.set("q", search);
  const qs = params.toString();
  return qs ? `${DIRECTOR_APPLICATIONS_LIST_PATH}?${qs}` : DIRECTOR_APPLICATIONS_LIST_PATH;
}

/**
 * Build application detail href carrying list return context.
 *
 * @param {string} applicationId
 * @param {string|{ status?: string, workflow?: string, stage?: string, assessor?: string, q?: string }} listHrefOrFilters
 * @returns {string}
 */
export function buildDirectorApplicationDetailHref(applicationId, listHrefOrFilters) {
  const id = typeof applicationId === "string" ? applicationId.trim() : "";
  if (!id) return DIRECTOR_APPLICATIONS_LIST_PATH;

  const listHref =
    typeof listHrefOrFilters === "string"
      ? resolveDirectorApplicationsReturnTo(listHrefOrFilters)
      : buildDirectorApplicationsListHref(listHrefOrFilters || {});

  const params = new URLSearchParams();
  params.set(DIRECTOR_APPLICATIONS_RETURN_PARAM, listHref);
  return `${DIRECTOR_APPLICATIONS_LIST_PATH}/${encodeURIComponent(id)}?${params.toString()}`;
}

/**
 * Validate/normalize a returnTo value. Only `/director/applications` (+ allowed query) is accepted.
 * Rejects external, protocol-relative, and other internal routes.
 *
 * @param {string|null|undefined} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolveDirectorApplicationsReturnTo(
  raw,
  fallback = DIRECTOR_APPLICATIONS_LIST_PATH
) {
  if (raw == null || typeof raw !== "string") return fallback;

  let decoded = raw.trim();
  if (!decoded) return fallback;

  // useSearchParams / URLSearchParams usually decode once; tolerate one extra decode.
  if (decoded.includes("%")) {
    try {
      const once = decodeURIComponent(decoded);
      if (once) decoded = once.trim();
    } catch {
      return fallback;
    }
  }

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//")) return fallback;
  if (decoded.includes("://")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) return fallback;
  if (decoded.toLowerCase().includes("javascript:")) return fallback;
  if (decoded.includes("\\")) return fallback;
  if (decoded.includes("@")) return fallback;

  let url;
  try {
    url = new URL(decoded, "http://local.invalid");
  } catch {
    return fallback;
  }

  // Exact list path only — not /director/applications/<id> or other Director routes.
  if (url.pathname !== DIRECTOR_APPLICATIONS_LIST_PATH) return fallback;
  if (url.username || url.password || url.hash) return fallback;

  const allowed = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (!ALLOWED_QUERY_KEY_SET.has(key)) continue;
    if (typeof value !== "string") continue;
    if (!value || value.length > MAX_QUERY_VALUE_LENGTH) continue;
    if (/[\r\n\0]/.test(value)) continue;
    allowed.set(key, value);
  }

  const qs = allowed.toString();
  return qs ? `${DIRECTOR_APPLICATIONS_LIST_PATH}?${qs}` : DIRECTOR_APPLICATIONS_LIST_PATH;
}
