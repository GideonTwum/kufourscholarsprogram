/**
 * Shared deadline comparison helpers (no I/O).
 * Boundary rule (aligned with Stage 1): currentTime > deadlineMs → expired.
 * At the exact deadline millisecond, submission remains allowed.
 */

/**
 * @param {string|null|undefined} deadlineRaw
 * @returns {{ deadlineMs: number|null, deadlineParsedIso: string|null, parseOk: boolean }}
 */
export function parseDeadlineRaw(deadlineRaw) {
  const raw = deadlineRaw == null ? "" : String(deadlineRaw).trim();
  if (!raw) {
    return { deadlineMs: null, deadlineParsedIso: null, parseOk: false };
  }
  const d = new Date(raw);
  const deadlineMs = d.getTime();
  if (Number.isNaN(deadlineMs)) {
    return { deadlineMs: null, deadlineParsedIso: null, parseOk: false };
  }
  return { deadlineMs, deadlineParsedIso: d.toISOString(), parseOk: true };
}

/**
 * @param {number|null} deadlineMs
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isDeadlineExpired(deadlineMs, nowMs = Date.now()) {
  if (deadlineMs == null || Number.isNaN(deadlineMs)) return false;
  return nowMs > deadlineMs;
}

/**
 * Format a deadline ISO string for Ghana / GMT display.
 * @param {string|null|undefined} deadlineIso
 * @returns {string}
 */
export function formatDeadlineGmt(deadlineIso) {
  const { deadlineMs, parseOk } = parseDeadlineRaw(deadlineIso);
  if (!parseOk || deadlineMs == null) return "";
  const d = new Date(deadlineMs);
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${datePart} at ${timePart} GMT`;
}
