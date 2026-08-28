/**
 * Pure Stage 1 applications open / deadline gate (no I/O).
 * Used by submit-stage1 and unit tests.
 */

export const APPLICATIONS_CLOSED_MESSAGE = "Applications are currently closed.";
export const APPLICATION_DEADLINE_PASSED_MESSAGE = "The application deadline has passed.";

/**
 * @param {{ applicationsOpen?: string|null, deadlineRaw?: string|null, nowMs?: number }} input
 * @returns {{ allowed: boolean, reason: null|string, isExpired: boolean, deadlineMs: number|null, deadlineParsedIso: string|null }}
 */
export function evaluateApplicationsOpenGate({
  applicationsOpen = null,
  deadlineRaw = null,
  nowMs = Date.now(),
} = {}) {
  const openVal = applicationsOpen == null ? null : String(applicationsOpen);
  if (openVal !== null && openVal !== "true") {
    return {
      allowed: false,
      reason: APPLICATIONS_CLOSED_MESSAGE,
      isExpired: false,
      deadlineMs: null,
      deadlineParsedIso: null,
    };
  }

  const raw = deadlineRaw == null ? "" : String(deadlineRaw).trim();
  if (!raw) {
    return {
      allowed: true,
      reason: null,
      isExpired: false,
      deadlineMs: null,
      deadlineParsedIso: null,
    };
  }

  const d = new Date(raw);
  const deadlineMs = d.getTime();
  if (Number.isNaN(deadlineMs)) {
    return {
      allowed: true,
      reason: null,
      isExpired: false,
      deadlineMs: null,
      deadlineParsedIso: null,
    };
  }

  const isExpired = nowMs > deadlineMs;
  return {
    allowed: !isExpired,
    reason: isExpired ? APPLICATION_DEADLINE_PASSED_MESSAGE : null,
    isExpired,
    deadlineMs,
    deadlineParsedIso: d.toISOString(),
  };
}

/**
 * Safe host extraction for diagnostics (no secrets).
 * @param {string|undefined|null} supabaseUrl
 */
export function supabaseProjectHostFromUrl(supabaseUrl) {
  try {
    return new URL(String(supabaseUrl || "")).hostname || null;
  } catch {
    return null;
  }
}
