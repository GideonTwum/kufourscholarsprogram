/**
 * Non-secret auth/email configuration health snapshot (server-only).
 */

import { getEmailConfig, EMAIL_FROM_MISSING, EMAIL_FROM_INVALID } from "./email/config.js";
import { getPublicSiteUrl, passwordResetCallbackUrl } from "./auth-recovery.js";

function status(configured) {
  return configured ? "configured" : "missing";
}

function emailFromStatus(cfg) {
  if (cfg.fromError === EMAIL_FROM_INVALID) return "invalid";
  if (cfg.fromError === EMAIL_FROM_MISSING && !cfg.usingDevFallbackFrom) return "missing";
  if (cfg.configuredFrom && isValidConfigured(cfg)) return "configured";
  if (cfg.usingDevFallbackFrom) return "missing";
  if (cfg.configuredFrom) return "invalid";
  return "missing";
}

function isValidConfigured(cfg) {
  return Boolean(cfg.configuredFrom) && !cfg.fromError && !cfg.usingDevFallbackFrom;
}

/**
 * @param {{ requestHost?: string|null }} [opts]
 */
export function buildAuthEmailHealth(opts = {}) {
  const cfg = getEmailConfig();
  const siteUrl = getPublicSiteUrl();
  const supabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const anonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const serviceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  let siteUrlMatchesRequestHost = null;
  const host = opts.requestHost || null;
  if (siteUrl && host) {
    try {
      siteUrlMatchesRequestHost = new URL(siteUrl).host === host;
    } catch {
      siteUrlMatchesRequestHost = false;
    }
  }

  return {
    supabase_url: status(supabaseUrl),
    supabase_anon_key: status(anonKey),
    service_role: status(serviceRole),
    resend_api_key: status(Boolean(cfg.resendApiKey)),
    email_from: emailFromStatus(cfg),
    email_from_domain: cfg.emailFromDomainClass,
    sandbox_sender_in_use: Boolean(cfg.sandboxSenderInUse),
    email_from_using_dev_fallback: Boolean(cfg.usingDevFallbackFrom),
    site_url: status(Boolean(siteUrl)),
    site_url_matches_request_host: siteUrlMatchesRequestHost,
    auth_callback_url: siteUrl
      ? `${siteUrl}/auth/callback`
      : "(set NEXT_PUBLIC_SITE_URL)",
    password_reset_callback_url: siteUrl
      ? passwordResetCallbackUrl(siteUrl)
      : "(set NEXT_PUBLIC_SITE_URL)",
    mfa_required_for_director: true,
    applicant_verification: "email_confirmation_link",
    typed_otp: false,
    sms_otp: false,
    manual_checks: {
      supabase_site_url: "Verify manually in Supabase Dashboard → Authentication → URL Configuration",
      supabase_redirect_allowlist:
        "Verify /auth/callback and production site origin are allowlisted",
      supabase_confirm_email: "Verify Confirm email is enabled for applicants",
      supabase_mfa: "Verify MFA (TOTP) is enabled in Supabase Auth settings",
      resend_domain:
        "Verify sending domain DNS for the address in EMAIL_FROM (expected production domain: kufuorscholarapplication.com)",
      resend_delivery_logs: "Verify delivery in Resend dashboard after inbox tests",
      edge_email_from:
        "Set the same EMAIL_FROM on Supabase Edge Function secrets as on Vercel (see AUTH-EMAIL-PRODUCTION-CONFIG.md)",
    },
  };
}
