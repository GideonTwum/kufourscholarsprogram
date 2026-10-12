/**
 * Applicant email-change request checks and safe Auth error mapping.
 * Logs and responses must not include addresses, tokens, or credentials.
 */

import { isValidEmailFormat } from "./auth-recovery.js";

export const EMAIL_CHANGE_SENT_MESSAGE =
  "Verification email sent. Please check your inbox to confirm your new email address.";

export const EMAIL_CHANGE_BOTH_INBOXES_MESSAGE =
  "Confirm the message sent to your current address and the new address. Your current email stays active until verification is complete.";

export function validateEmailChangeRequest(currentEmail, nextEmail) {
  const email = typeof nextEmail === "string" ? nextEmail.trim().toLowerCase() : "";
  if (!isValidEmailFormat(email)) {
    return { ok: false, status: 400, field: "email", error: "Enter a valid email address." };
  }
  const current = typeof currentEmail === "string" ? currentEmail.trim().toLowerCase() : "";
  if (current && email === current) {
    return { ok: false, status: 400, field: "email", error: "That is already your email address." };
  }
  return { ok: true, email };
}

export function redactEmailText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/token_hash=[^&\s]+/gi, "token_hash=[redacted]")
    .slice(0, 160);
}

/**
 * @param {unknown} error
 */
export function classifyEmailChangeError(error) {
  const code = String(error && typeof error === "object" && error.code ? error.code : "");
  const status = Number(error && typeof error === "object" && error.status ? error.status : 0);
  const lower = String(error && typeof error === "object" && error.message ? error.message : "").toLowerCase();

  if (code === "timeout" || /timeout|timed out|aborted/i.test(lower)) {
    return {
      status: 504,
      code: "timeout",
      error: "The email service did not respond. Try again in a moment.",
    };
  }
  if (
    status === 401 ||
    code === "session_not_found" ||
    code === "reauthentication_needed" ||
    /session.*(expired|missing)|jwt expired|reauthentication/i.test(lower)
  ) {
    return {
      status: 401,
      code: "session_expired",
      error: "Your session has expired. Sign in again, then request the email change.",
    };
  }
  if (
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    /rate limit|too many requests|email rate/i.test(lower)
  ) {
    return {
      status: 429,
      code: "rate_limited",
      error: "Too many email change attempts. Try again later.",
    };
  }
  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    /already registered|already been registered|already in use|email address is already/i.test(lower)
  ) {
    return {
      status: 409,
      code: "duplicate_email",
      field: "email",
      error: "That email address is already in use.",
    };
  }
  return {
    status: 400,
    code: code || "auth_update_failed",
    error: "The email change could not be started. Try again.",
  };
}

export function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((value) => ({ timedOut: false, value })),
    timeout,
  ]).finally(() => clearTimeout(timer));
}
