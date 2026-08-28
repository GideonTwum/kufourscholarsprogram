/**
 * Single source of truth for applicant-facing support contact.
 * Update the email here to change it site-wide.
 */

export const APPLICANT_SUPPORT_EMAIL = "twumgideonasare@gmail.com";

export const APPLICANT_SUPPORT_TITLE = "Need Help With Your Application?";

export const APPLICANT_SUPPORT_BODY =
  "For all application queries, registration issues, email verification problems, or technical difficulties, please contact";

export function applicantSupportMailto() {
  return `mailto:${APPLICANT_SUPPORT_EMAIL}`;
}
