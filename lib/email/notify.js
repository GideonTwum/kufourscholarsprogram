/**
 * Optional transactional email via Resend (https://resend.com).
 * Set RESEND_API_KEY and EMAIL_FROM in production.
 */

const RESEND_API = "https://api.resend.com/emails";

export async function sendTransactionalEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Kufuor Scholars <onboarding@resend.dev>";
  const recipients = Array.isArray(to) ? to : [to].filter(Boolean);
  const primary = recipients[0];
  if (!key || !primary) {
    if (process.env.NODE_ENV === "development") {
      console.info("[email skipped]", { to: recipients, subject });
    }
    return { sent: false, reason: "no_api_key_or_to" };
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html: html || `<pre>${escapeHtml(text || "")}</pre>`,
      text: text || "",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[email error]", res.status, json);
    return { sent: false, error: json };
  }
  return { sent: true, id: json.id };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function acceptanceEmailHtml(fullName) {
  const name = fullName || "Scholar";
  return `
    <p>Dear ${escapeHtml(name)},</p>
    <p><strong>Congratulations!</strong> We are pleased to inform you that your application to the Kufuor Scholars Program has been accepted.</p>
    <p>The team will share next steps with you shortly.</p>
    <p>Best regards,<br/>The Kufuor Scholars Program Team<br/>The John A. Kufuor Foundation</p>
  `;
}

export function rejectionEmailHtml(fullName, reason) {
  const name = fullName || "Applicant";
  const r = reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : "";
  return `
    <p>Dear ${escapeHtml(name)},</p>
    <p>Thank you for your interest in the Kufuor Scholars Program. After careful review, we are unable to offer you a place at this time.</p>
    ${r}
    <p>We encourage you to stay connected with the John A. Kufuor Foundation for future opportunities.</p>
    <p>Best regards,<br/>The Kufuor Scholars Program Team</p>
  `;
}

export function autoRejectEmailHtml(fullName, reason) {
  return rejectionEmailHtml(fullName, reason);
}
