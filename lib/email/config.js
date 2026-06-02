/**
 * Email configuration for Resend + optional Supabase Edge Function `send-email`.
 */

const DEV_FALLBACK_FROM = "Kufuor Scholars <onboarding@resend.dev>";

let configWarningsLogged = false;

export function getEmailConfig() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
  const emailFrom = process.env.EMAIL_FROM?.trim() || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  const usingDevFallbackFrom = !emailFrom;
  const from = emailFrom || DEV_FALLBACK_FROM;

  const missing = [];
  if (!resendApiKey) missing.push("RESEND_API_KEY");
  if (!emailFrom) missing.push("EMAIL_FROM");
  if (!siteUrl) missing.push("NEXT_PUBLIC_SITE_URL");

  return {
    resendApiKey,
    emailFrom: from,
    configuredFrom: emailFrom,
    siteUrl,
    serviceRoleKey,
    usingDevFallbackFrom,
    canSend: Boolean(resendApiKey && from),
    /** Production should not rely on onboarding@resend.dev */
    isProductionReady: Boolean(
      resendApiKey && emailFrom && !usingDevFallbackFrom
    ),
    missing,
  };
}

/**
 * Log configuration issues once per process (dev: warn, production: error).
 */
export function warnEmailConfigOnce() {
  if (configWarningsLogged) return getEmailConfig();
  configWarningsLogged = true;

  const cfg = getEmailConfig();
  const isDev = process.env.NODE_ENV === "development";

  if (!cfg.resendApiKey) {
    const msg =
      "[KSP Email] RESEND_API_KEY is not set. Transactional emails will be skipped or fail. Add it to .env.local (see .env.example).";
    if (isDev) console.warn(msg);
    else console.error(msg);
  }

  if (!cfg.configuredFrom) {
    const msg =
      "[KSP Email] EMAIL_FROM is not set. Using Resend sandbox sender (onboarding@resend.dev) — only works for your Resend account email in dev. Set EMAIL_FROM to a verified domain sender for production.";
    if (isDev) console.warn(msg);
    else console.error(msg);
  }

  if (!cfg.siteUrl) {
    const msg =
      "[KSP Email] NEXT_PUBLIC_SITE_URL is not set. Auth invite/verification redirect URLs may be wrong in production.";
    if (isDev) console.warn(msg);
    else console.warn(msg);
  }

  if (!cfg.serviceRoleKey) {
    const msg =
      "[KSP Email] SUPABASE_SERVICE_ROLE_KEY is not set. Edge Function invoke and email_logs writes may fail; direct Resend fallback still works if RESEND_API_KEY is set.";
    if (isDev) console.warn(msg);
    else console.error(msg);
  }

  if (!isDev && cfg.resendApiKey && !cfg.isProductionReady) {
    console.error(
      "[KSP Email] PRODUCTION: Configure EMAIL_FROM with a verified Resend domain (e.g. Kufuor Scholars Program <noreply@yourdomain.com>)."
    );
  }

  return cfg;
}

function redactSecrets(text) {
  return String(text)
    .replace(/re_[A-Za-z0-9]+/g, "[REDACTED_RESEND_KEY]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
}

export function getSafeEmailErrorMessage(err) {
  if (!err) return "Unknown email error";
  let raw = "";
  if (typeof err === "string") raw = err;
  else if (err.message) raw = String(err.message);
  else {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = "Email delivery failed";
    }
  }
  return redactSecrets(raw).slice(0, 500);
}
