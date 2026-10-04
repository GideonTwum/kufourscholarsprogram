/**
 * Pure Stage 2 deadline gate (no I/O).
 * Independent of Stage 1 application_deadline / applications_open.
 *
 * Fail-closed: missing or invalid stage_2_deadline blocks final Stage 2 submission.
 * Boundary: nowMs > deadlineMs → closed (same as Stage 1).
 */

import { formatDeadlineGmt, isDeadlineExpired, parseDeadlineRaw } from "./deadline-gate.js";

export const STAGE_2_DEADLINE_SETTING_KEY = "stage_2_deadline";

export const DEFAULT_STAGE_2_DEADLINE_ISO = "2026-10-11T23:59:00.000Z";

export const STAGE_2_DEADLINE_PASSED_MESSAGE =
  "Stage 2 submissions are closed. The submission deadline has passed.";

export const STAGE_2_DEADLINE_NOT_CONFIGURED_MESSAGE =
  "Stage 2 submissions are temporarily unavailable. Please try again later or contact KSP support.";

/** Only status that may submit Stage 2 (matches assertStatusTransition). */
export const STAGE_2_SUBMIT_ELIGIBLE_STATUS = "stage_1_approved";

/**
 * @param {{ deadlineRaw?: string|null, nowMs?: number }} input
 * @returns {{
 *   allowed: boolean,
 *   reason: null|string,
 *   isExpired: boolean,
 *   isConfigured: boolean,
 *   deadlineMs: number|null,
 *   deadlineParsedIso: string|null,
 * }}
 */
export function evaluateStage2DeadlineGate({ deadlineRaw = null, nowMs = Date.now() } = {}) {
  const { deadlineMs, deadlineParsedIso, parseOk } = parseDeadlineRaw(deadlineRaw);
  if (!parseOk) {
    return {
      allowed: false,
      reason: STAGE_2_DEADLINE_NOT_CONFIGURED_MESSAGE,
      isExpired: false,
      isConfigured: false,
      deadlineMs: null,
      deadlineParsedIso: null,
    };
  }

  const expired = isDeadlineExpired(deadlineMs, nowMs);
  return {
    allowed: !expired,
    reason: expired ? STAGE_2_DEADLINE_PASSED_MESSAGE : null,
    isExpired: expired,
    isConfigured: true,
    deadlineMs,
    deadlineParsedIso,
  };
}

/**
 * Absolute deadline line for applicant UI.
 * @param {string|null|undefined} deadlineIso
 */
export function stage2DeadlineAbsoluteCopy(deadlineIso) {
  const formatted = formatDeadlineGmt(deadlineIso);
  if (!formatted) return "";
  return `Submit Stage 2 by ${formatted}.`;
}

/**
 * Closed-state absolute line for applicant UI.
 * @param {string|null|undefined} deadlineIso
 */
export function stage2DeadlineClosedCopy(deadlineIso) {
  const formatted = formatDeadlineGmt(deadlineIso);
  if (!formatted) {
    return "Stage 2 submissions are closed.";
  }
  return `The Stage 2 submission deadline was ${formatted}.`;
}
