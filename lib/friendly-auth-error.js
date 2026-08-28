/**
 * Map Supabase Auth errors to applicant-safe messages.
 * Never return raw provider/database text to the UI.
 */

export const AUTH_GENERIC_ERROR =
  "Something went wrong. Please try again. If the problem continues, contact KSP support.";

export const AUTH_INVALID_CREDENTIALS = "Invalid email or password.";

export const AUTH_EMAIL_NOT_CONFIRMED =
  "Please verify your email address before signing in. Check your inbox or request a new verification email.";

export const AUTH_ALREADY_REGISTERED =
  "An account with this email already exists. Sign in, or reset your password if you forgot it.";

export const AUTH_REGISTER_EXISTING_HINT =
  "An account may already exist for this email. Please resend your verification email or sign in.";

export const AUTH_RATE_LIMITED =
  "Too many attempts. Please wait a few minutes and try again.";

export const AUTH_REGISTER_RATE_LIMITED =
  "Too many registration attempts. Please wait a few minutes and try again.";

export const AUTH_WEAK_PASSWORD =
  "Choose a stronger password (at least 8 characters with upper, lower, number, and special character).";

export const AUTH_REGISTER_SYSTEM =
  "We couldn't create your account due to a temporary system issue. Please try again in a few minutes. If it continues, contact support.";

export const AUTH_REGISTER_GENERIC =
  "We couldn't create your account. Please check your details and try again.";

/**
 * @param {unknown} error
 */
function readAuthError(error) {
  const msg = String(
    (error && typeof error === "object" && error.message) ||
      (typeof error === "string" ? error : "") ||
      ""
  );
  const code = String((error && typeof error === "object" && error.code) || "");
  const status = Number((error && typeof error === "object" && error.status) || 0);
  const lower = msg.toLowerCase();
  return { msg, code, status, lower };
}

/**
 * Classify signup failures for UI + diagnostics (no secrets).
 * @param {unknown} error
 * @returns {{ stage: string, code: string|null, status: number, message: string|null, friendly: string }}
 */
export function classifySignupAuthFailure(error) {
  const { msg, code, status, lower } = readAuthError(error);

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already been registered|user already exists|email address is already|email.*exists/i.test(
      lower
    )
  ) {
    return {
      stage: "USER_ALREADY_EXISTS",
      code: code || "user_already_exists",
      status,
      message: msg.slice(0, 200) || null,
      friendly: AUTH_REGISTER_EXISTING_HINT,
    };
  }

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    /rate limit|too many requests|email rate|only request this after|security purposes/i.test(lower)
  ) {
    return {
      stage: "EMAIL_RATE_LIMITED",
      code: code || "rate_limited",
      status: status || 429,
      message: msg.slice(0, 200) || null,
      friendly: AUTH_REGISTER_RATE_LIMITED,
    };
  }

  if (code === "weak_password" || /password.*(weak|short|characters)/i.test(lower)) {
    return {
      stage: "WEAK_PASSWORD",
      code: code || "weak_password",
      status,
      message: msg.slice(0, 200) || null,
      friendly: AUTH_WEAK_PASSWORD,
    };
  }

  if (
    /redirect/i.test(lower) ||
    code === "validation_failed" && /redirect/i.test(lower)
  ) {
    return {
      stage: "REDIRECT_URL_NOT_ALLOWED",
      code: code || "redirect_not_allowed",
      status,
      message: msg.slice(0, 200) || null,
      friendly: AUTH_REGISTER_SYSTEM,
    };
  }

  if (
    /database error saving new user|database error|error creating user|trigger|violates|duplicate key/i.test(
      lower
    ) ||
    status === 500
  ) {
    return {
      stage: "DATABASE_TRIGGER_FAILED",
      code: code || "database_error",
      status: status || 500,
      message: msg.slice(0, 200) || null,
      friendly: AUTH_REGISTER_SYSTEM,
    };
  }

  if (/smtp|error sending|confirmation email|mail/i.test(lower) && status >= 400) {
    return {
      stage: "SMTP_FAILURE",
      code: code || "smtp_error",
      status,
      message: msg.slice(0, 200) || null,
      friendly: AUTH_REGISTER_SYSTEM,
    };
  }

  return {
    stage: "SIGNUP_AUTH_FAILED",
    code: code || null,
    status,
    message: msg.slice(0, 200) || null,
    friendly: AUTH_REGISTER_GENERIC,
  };
}

/**
 * @param {unknown} error - Supabase AuthError or similar
 * @param {"login"|"register"|"resend"|"generic"} context
 */
export function toFriendlyAuthError(error, context = "generic") {
  const { msg, code, status, lower } = readAuthError(error);

  if (
    code === "email_not_confirmed" ||
    /email not confirmed|not confirmed/i.test(msg)
  ) {
    return AUTH_EMAIL_NOT_CONFIRMED;
  }

  if (
    code === "invalid_credentials" ||
    /invalid login credentials|invalid_credentials/i.test(lower)
  ) {
    return AUTH_INVALID_CREDENTIALS;
  }

  if (context === "register") {
    return classifySignupAuthFailure(error).friendly;
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already been registered|user already exists|email address is already/i.test(
      lower
    )
  ) {
    return AUTH_ALREADY_REGISTERED;
  }

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    /rate limit|too many requests|email rate|only request this after|security purposes/i.test(lower)
  ) {
    return AUTH_RATE_LIMITED;
  }

  if (
    code === "weak_password" ||
    /password.*(weak|short|characters)/i.test(lower)
  ) {
    return AUTH_WEAK_PASSWORD;
  }

  if (context === "login") {
    return "Sign-in failed. Please try again.";
  }
  if (context === "resend") {
    return "Could not resend verification email. Try again shortly.";
  }

  return AUTH_GENERIC_ERROR;
}

/**
 * Detect Supabase "fake success" for existing emails (empty identities).
 * @param {{ user?: { identities?: unknown[] } | null } | null | undefined} data
 */
export function isLikelyExistingUnconfirmedSignup(data) {
  const user = data?.user;
  if (!user) return false;
  const identities = user.identities;
  return Array.isArray(identities) && identities.length === 0;
}
