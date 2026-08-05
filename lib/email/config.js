/**
 * Email configuration for Resend + optional Supabase Edge Function `send-email`.
 *
 * Canonical production sender (set via EMAIL_FROM, do not hardcode at send time):
 *   Kufuor Scholars Program <noreply@kufuorscholarapplication.com>
 *
 * Production never silently falls back to onboarding@resend.dev.
 */

export const SANDBOX_FALLBACK_FROM =
  "Kufuor Scholars Program <onboarding@resend.dev>";

/** Expected verified sending domain for production health classification (not a runtime from override). */
export const PRODUCTION_EMAIL_FROM_DOMAIN = "kufuorscholarapplication.com";

export const EMAIL_FROM_MISSING = "EMAIL_FROM_MISSING";
export const EMAIL_FROM_INVALID = "EMAIL_FROM_INVALID";

let configWarningsLogged = false;

/**
 * Light validation: bare email or `Display Name <email@domain>`.
 * @param {string} value
 */
export function isValidEmailFrom(value) {
  const s = String(value ?? "").trim();
  if (!s || s.length > 320) return false;
  if (/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s)) return true;
  // Display Name <local@domain.tld>
  if (/^[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(s)) return true;
  return false;
}

/**
 * @param {string} value
 * @returns {string} lowercase address or ""
 */
export function extractEmailAddress(value) {
  const s = String(value ?? "").trim();
  const angled = s.match(/<([^>]+)>/);
  const addr = (angled ? angled[1] : s).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return "";
  return addr;
}

export function isSandboxSender(value) {
  return extractEmailAddress(value) === "onboarding@resend.dev";
}

/**
 * @param {string} value
 * @returns {'production_verified_domain'|'sandbox'|'other_domain'|'unknown'}
 */
export function classifyEmailFromDomain(value) {
  const addr = extractEmailAddress(value);
  if (!addr) return "unknown";
  if (addr === "onboarding@resend.dev") return "sandbox";
  const domain = addr.split("@")[1] || "";
  if (domain === PRODUCTION_EMAIL_FROM_DOMAIN) return "production_verified_domain";
  return "other_domain";
}

function isProductionEnv(env) {
  return String(env.NODE_ENV || "").toLowerCase() === "production";
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string|undefined>} [env]
 */
export function getEmailConfig(env = process.env) {
  const resendApiKey = String(env.RESEND_API_KEY || "").trim();
  const configuredFrom = String(env.EMAIL_FROM || "").trim();
  const siteUrl = String(env.NEXT_PUBLIC_SITE_URL || "").trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const production = isProductionEnv(env);

  const missing = [];
  if (!resendApiKey) missing.push("RESEND_API_KEY");
  if (!configuredFrom) missing.push("EMAIL_FROM");
  if (!siteUrl) missing.push("NEXT_PUBLIC_SITE_URL");

  /** @type {string|null} */
  let emailFrom = null;
  /** @type {string|null} */
  let fromError = null;
  let usingDevFallbackFrom = false;
  let sandboxSenderInUse = false;

  if (configuredFrom) {
    if (isValidEmailFrom(configuredFrom)) {
      emailFrom = configuredFrom;
      sandboxSenderInUse = isSandboxSender(configuredFrom);
      if (production && sandboxSenderInUse) {
        // Explicit sandbox in production env is treated as invalid for send readiness.
        fromError = EMAIL_FROM_INVALID;
        emailFrom = null;
        sandboxSenderInUse = false;
      }
    } else {
      fromError = EMAIL_FROM_INVALID;
    }
  } else if (production) {
    fromError = EMAIL_FROM_MISSING;
  } else {
    // Development / test: explicit sandbox fallback only.
    emailFrom = SANDBOX_FALLBACK_FROM;
    usingDevFallbackFrom = true;
    sandboxSenderInUse = true;
  }

  const canSend = Boolean(resendApiKey && emailFrom && !fromError);
  const isProductionReady = Boolean(
    production &&
      canSend &&
      configuredFrom &&
      !sandboxSenderInUse &&
      classifyEmailFromDomain(configuredFrom) === "production_verified_domain"
  );

  return {
    resendApiKey,
    emailFrom,
    configuredFrom,
    siteUrl,
    serviceRoleKey,
    usingDevFallbackFrom,
    sandboxSenderInUse,
    fromError,
    canSend,
    isProductionReady,
    isProduction: production,
    emailFromDomainClass: emailFrom
      ? classifyEmailFromDomain(emailFrom)
      : configuredFrom
        ? classifyEmailFromDomain(configuredFrom)
        : "unknown",
    missing,
  };
}

/**
 * Log configuration issues once per process (dev: warn, production: error).
 * Never logs secret values.
 */
export function warnEmailConfigOnce(env = process.env) {
  if (configWarningsLogged) return getEmailConfig(env);
  configWarningsLogged = true;

  const cfg = getEmailConfig(env);
  const isDev = !cfg.isProduction;

  if (!cfg.resendApiKey) {
    const msg =
      "[KSP Email] RESEND_API_KEY is not set. Transactional emails will be skipped or fail.";
    if (isDev) console.warn(msg);
    else console.error(msg);
  }

  if (cfg.fromError === EMAIL_FROM_MISSING) {
    console.error(
      "[KSP Email] EMAIL_FROM_MISSING: Set EMAIL_FROM to a verified sender (e.g. Kufuor Scholars Program <noreply@verified-domain>). Production will not use the Resend sandbox."
    );
  } else if (cfg.fromError === EMAIL_FROM_INVALID) {
    console.error(
      "[KSP Email] EMAIL_FROM_INVALID: EMAIL_FROM must be an email or Display Name <email@domain>. Sandbox onboarding@resend.dev is not allowed in production."
    );
  } else if (cfg.usingDevFallbackFrom) {
    console.warn(
      "[KSP Email] EMAIL_FROM is not set. Using development sandbox sender (onboarding@resend.dev). Set EMAIL_FROM for real deliveries."
    );
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

  return cfg;
}

/** Test helper */
export function __resetEmailConfigWarningFlagForTests() {
  configWarningsLogged = false;
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
  else if (err.code && typeof err.code === "string") raw = err.code;
  else {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = "Email delivery failed";
    }
  }
  return redactSecrets(raw).slice(0, 500);
}
