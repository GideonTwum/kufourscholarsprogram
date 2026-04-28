import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/notify";

/**
 * Sends email via Supabase Edge Function (`send-email`) when available; falls back to Resend from the app server.
 */
export async function sendPlatformEmail({ to, subject, html, text, template, meta }) {
  const payload = { to, subject, html, text, template, meta };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.functions.invoke("send-email", {
      body: payload,
    });
    if (!error && data && !data.error) {
      return { ok: true, via: "edge", data };
    }
    if (error) {
      console.warn("[sendPlatformEmail] edge invoke:", error.message);
    }
  } catch (e) {
    console.warn("[sendPlatformEmail] edge unavailable, using direct Resend:", e?.message ?? e);
  }

  const recipients = Array.isArray(to) ? to : [to];
  const results = [];
  for (const addr of recipients) {
    const r = await sendTransactionalEmail({ to: addr, subject, html, text });
    results.push(r);
  }
  return { ok: results.some((r) => r.sent), via: "resend", results };
}
