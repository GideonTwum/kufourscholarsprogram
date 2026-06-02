import { sendTransactionalEmail } from "@/lib/email/notify";
import { warnEmailConfigOnce, getEmailConfig, getSafeEmailErrorMessage } from "@/lib/email/config";
import { logEmailEvent } from "@/lib/email/log";

/**
 * Send via Edge Function when service role + function available; else direct Resend.
 * Never throws; does not block calling workflows.
 */
export async function sendKspEmail({
  event,
  to,
  subject,
  html,
  text,
  template,
  meta,
  directorId = null,
  requireDelivery = false,
}) {
  const cfg = warnEmailConfigOnce();

  if (!cfg.canSend && process.env.NODE_ENV === "production") {
    console.error(
      `[KSP Email] cannot send (${event || "unknown"}): missing ${cfg.missing.join(", ") || "configuration"}`
    );
  }

  const recipients = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))];
  if (recipients.length === 0) {
    await logEmailEvent({
      event,
      to: ["(none)"],
      subject,
      status: "skipped",
      directorId,
      detail: "No recipient address",
    });
    return { ok: false, sent: false, skipped: true, via: null, reason: "no_recipient" };
  }

  const payload = { to: recipients, subject, html, text, template, meta };

  let via = null;
  let lastError = null;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin.functions.invoke("send-email", { body: payload });

    if (!error && data?.success) {
      via = "edge";
      await logEmailEvent({
        event,
        to: recipients,
        subject,
        status: "sent",
        directorId,
        detail: `via=edge id=${data.id || ""}`,
      });
      return { ok: true, sent: true, skipped: false, via, id: data.id };
    }

    if (error) {
      lastError = error.message;
      console.warn(`[KSP Email] edge invoke failed (${event}):`, error.message);
    } else if (data?.error) {
      lastError = getSafeEmailErrorMessage(data.error);
      console.warn(`[KSP Email] edge returned error (${event}):`, lastError);
    }
  } catch (e) {
    lastError = e?.message ?? String(e);
    console.warn(`[KSP Email] edge unavailable (${event}), using Resend:`, lastError);
  }

  const results = [];
  for (const addr of recipients) {
    const r = await sendTransactionalEmail({ to: addr, subject, html, text });
    results.push(r);
  }

  const anySent = results.some((r) => r.sent);
  via = "resend";

  if (anySent) {
    await logEmailEvent({
      event,
      to: recipients,
      subject,
      status: "sent",
      directorId,
      detail: `via=resend`,
    });
    return {
      ok: true,
      sent: true,
      skipped: false,
      via,
      id: results.find((r) => r.id)?.id,
    };
  }

  const reason =
    results.find((r) => r.reason)?.reason ||
    getSafeEmailErrorMessage(results.find((r) => r.error)?.error) ||
    lastError ||
    "send_failed";

  const status = results.some((r) => r.reason === "no_api_key_or_to") ? "skipped" : "failed";

  console.error(`[KSP Email] failed (${event}):`, reason);

  await logEmailEvent({
    event,
    to: recipients,
    subject,
    status,
    directorId,
    error: reason,
  });

  return {
    ok: false,
    sent: false,
    skipped: status === "skipped",
    via,
    reason,
    requireDelivery,
  };
}

/** @deprecated Use sendKspEmail — kept for imports migrating gradually */
export async function sendPlatformEmail(opts) {
  const result = await sendKspEmail({
    event: opts.template || "platform",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    template: opts.template,
    meta: opts.meta,
  });
  return { ok: result.ok, via: result.via, results: [result] };
}
