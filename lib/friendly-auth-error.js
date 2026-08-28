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

export const AUTH_RATE_LIMITED =
  "Too many attempts. Please wait a few minutes and try again.";

export const AUTH_WEAK_PASSWORD =
  "Choose a stronger password (at least 8 characters with upper, lower, number, and special character).";

/**
 * @param {unknown} error - Supabase AuthError or similar
 * @param {"login"|"register"|"resend"|"generic"} context
 */
export function toFriendlyAuthError(error, context = "generic") {
  const msg = String(
    (error && typeof error === "object" && error.message) ||
      (typeof error === "string" ? error : "") ||
      ""
  );
  const code = String((error && typeof error === "object" && error.code) || "");
  const status = Number((error && typeof error === "object" && error.status) || 0);
  const lower = msg.toLowerCase();

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

  if (
    code === "user_already_exists" ||
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
    /rate limit|too many requests|email rate/i.test(lower)
  ) {
    return AUTH_RATE_LIMITED;
  }

  if (
    code === "weak_password" ||
    /password.*(weak|short|characters)/i.test(lower)
  ) {
    return AUTH_WEAK_PASSWORD;
  }

  if (context === "register") {
    return "We couldn't create your account. Please check your details and try again.";
  }
  if (context === "login") {
    return "Sign-in failed. Please try again.";
  }
  if (context === "resend") {
    return "Could not resend verification email. Try again shortly.";
  }

  return AUTH_GENERIC_ERROR;
}
