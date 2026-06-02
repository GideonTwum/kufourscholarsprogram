import { createAdminClient } from "@/lib/supabase/admin";
import { getSafeEmailErrorMessage } from "@/lib/email/config";

/**
 * Persist send attempt to email_logs (best-effort; never throws).
 */
export async function logEmailEvent({
  event,
  to,
  subject,
  status,
  directorId = null,
  detail = "",
  error = null,
}) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return;

  const errorText = error ? getSafeEmailErrorMessage(error) : "";
  const message = [
    `[${event || "unknown"}]`,
    detail ? String(detail).slice(0, 1500) : "",
    errorText ? `Error: ${errorText}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 4000);

  try {
    let admin;
    try {
      admin = createAdminClient();
    } catch (e) {
      console.warn("[KSP Email] email_logs skipped (no admin client):", e?.message ?? e);
      return;
    }
    await admin.from("email_logs").insert({
      sender_director_id: directorId,
      recipients,
      subject: subject?.slice(0, 500) || "(no subject)",
      message: message || `[${event}]`,
      status: status || "unknown",
    });
  } catch (e) {
    console.error("[KSP Email] email_logs insert failed:", e?.message ?? e);
  }
}
