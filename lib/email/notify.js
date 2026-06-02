/**
 * Direct Resend API (server-side). Prefer sendKspEmail() for logging + edge fallback.
 */
import { warnEmailConfigOnce, getSafeEmailErrorMessage } from "@/lib/email/config";

const RESEND_API = "https://api.resend.com/emails";

export async function sendTransactionalEmail({ to, subject, html, text }) {
  const cfg = warnEmailConfigOnce();
  const recipients = Array.isArray(to) ? to : [to].filter(Boolean);
  const primary = recipients[0];

  if (!cfg.resendApiKey || !primary) {
    if (process.env.NODE_ENV === "development") {
      console.info("[KSP Email] skipped (no API key or recipient)", {
        event: "direct_resend",
        to: recipients,
        subject,
      });
    }
    return { sent: false, reason: "no_api_key_or_to" };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.emailFrom,
        to: recipients,
        subject,
        html: html || `<pre>${escapeHtml(text || "")}</pre>`,
        text: text || "",
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = getSafeEmailErrorMessage(json);
      console.error("[KSP Email] Resend API error:", res.status, msg);
      return { sent: false, error: msg, status: res.status };
    }
    return { sent: true, id: json.id };
  } catch (e) {
    const msg = getSafeEmailErrorMessage(e);
    console.error("[KSP Email] Resend request failed:", msg);
    return { sent: false, error: msg };
  }
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

export function interviewInviteHtml(k) {
  const esc = (str) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `
<p>Dear ${esc(k.name)},</p>
<p>You have been <strong>called for an interview</strong> with the Kufuor Scholars Program.</p>
<ul>
<li><strong>Date:</strong> ${esc(k.interviewDate)}</li>
<li><strong>Time:</strong> ${esc(k.interviewTime)}</li>
<li><strong>Location / link:</strong> ${esc(k.interviewLocation)}</li>
</ul>
${k.interviewInstructions ? `<p><strong>Instructions:</strong><br/>${esc(k.interviewInstructions)}</p>` : ""}
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
}

export function stage1SubmittedEmailHtml(fullName) {
  const name = fullName || "Applicant";
  return `
    <p>Dear ${escapeHtml(name)},</p>
    <p>Thank you for submitting your Stage 1 application to the Kufuor Scholars Program.</p>
    <p>Your status is <strong>Pending</strong> while the selection committee reviews your file. We will notify you of the outcome.</p>
    <p>Best regards,<br/>The Kufuor Scholars Program Team</p>
  `;
}
