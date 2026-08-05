/**
 * Shared HTML escaping for transactional email templates.
 * Escape first; only then convert newlines to <br/>.
 */

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape plain text, then turn newlines into <br/> (never the reverse). */
export function escapeHtmlWithBreaks(value) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br/>");
}
