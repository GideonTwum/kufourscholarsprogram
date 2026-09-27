import { sendKspEmail } from "./email/send.js";
import {
  COMMUNICATION_BATCH_SIZE,
  SENDING_CLAIM_STALE_MS,
  buildPersonalizedEmail,
  shouldAttemptDelivery,
} from "./director-communications.js";

export { SENDING_CLAIM_STALE_MS, shouldAttemptDelivery, continueUsesPersistedSnapshotOnly } from "./director-communications.js";

/**
 * Atomically claim one pending recipient for sending.
 * @returns {Promise<object|null>} claimed row or null if already taken
 */
export async function claimRecipientForSend(admin, recipientId) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("director_communication_recipients")
    .update({
      delivery_status: "sending",
      claimed_at: now,
    })
    .eq("id", recipientId)
    .eq("delivery_status", "pending")
    .select("id, email, full_name_snapshot, application_id")
    .maybeSingle();

  if (error) {
    console.error("[communications] claim failed:", error.message);
    return null;
  }
  return data || null;
}

/**
 * Reclaim stale sending rows (crashed mid-batch) back to pending.
 */
export async function reclaimStaleSendingRecipients(admin, communicationId, nowMs = Date.now()) {
  const cutoff = new Date(nowMs - SENDING_CLAIM_STALE_MS).toISOString();
  const { data } = await admin
    .from("director_communication_recipients")
    .update({
      delivery_status: "pending",
      claimed_at: null,
    })
    .eq("communication_id", communicationId)
    .eq("delivery_status", "sending")
    .lt("claimed_at", cutoff)
    .select("id");
  return (data || []).length;
}

/**
 * Process up to COMMUNICATION_BATCH_SIZE pending recipients.
 * @returns {Promise<{ ok: boolean, error?: string, batch_sent: number, batch_failed: number, remaining_pending: number, successful_count: number, failed_count: number, status: string, done: boolean, claimed: number }>}
 */
export async function processCommunicationBatch(admin, communicationId, directorId) {
  await reclaimStaleSendingRecipients(admin, communicationId);

  const { data: pending } = await admin
    .from("director_communication_recipients")
    .select("id, email, full_name_snapshot, application_id, delivery_status")
    .eq("communication_id", communicationId)
    .eq("delivery_status", "pending")
    .order("created_at", { ascending: true })
    .limit(COMMUNICATION_BATCH_SIZE);

  const { data: comm } = await admin
    .from("director_communications")
    .select("id, subject, body")
    .eq("id", communicationId)
    .maybeSingle();

  if (!comm) {
    return {
      ok: false,
      error: "Communication not found.",
      batch_sent: 0,
      batch_failed: 0,
      remaining_pending: 0,
      successful_count: 0,
      failed_count: 0,
      status: "failed",
      done: true,
      claimed: 0,
    };
  }

  let sent = 0;
  let failed = 0;
  let claimed = 0;

  for (const row of pending || []) {
    if (!shouldAttemptDelivery(row.delivery_status)) continue;

    const locked = await claimRecipientForSend(admin, row.id);
    if (!locked) {
      // Another worker claimed this row — skip (no double send).
      continue;
    }
    claimed += 1;

    const personalized = buildPersonalizedEmail({
      subject: comm.subject,
      body: comm.body,
      fullName: locked.full_name_snapshot,
    });

    const result = await sendKspEmail({
      event: "director_applicant_communication",
      to: locked.email,
      subject: personalized.subject,
      html: personalized.html,
      text: personalized.text,
      template: "director_applicant_communication",
      directorId,
      meta: { communication_id: communicationId, application_id: locked.application_id },
    });

    if (result.ok) {
      sent += 1;
      await admin
        .from("director_communication_recipients")
        .update({
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
          error_code: null,
        })
        .eq("id", locked.id)
        .eq("delivery_status", "sending");
    } else {
      failed += 1;
      await admin
        .from("director_communication_recipients")
        .update({
          delivery_status: "failed",
          error_code: result.reason || result.code || "send_failed",
          sent_at: new Date().toISOString(),
        })
        .eq("id", locked.id)
        .eq("delivery_status", "sending");
    }
  }

  const { count: remainingPending } = await admin
    .from("director_communication_recipients")
    .select("id", { count: "exact", head: true })
    .eq("communication_id", communicationId)
    .eq("delivery_status", "pending");

  const { count: remainingSending } = await admin
    .from("director_communication_recipients")
    .select("id", { count: "exact", head: true })
    .eq("communication_id", communicationId)
    .eq("delivery_status", "sending");

  const { count: successCount } = await admin
    .from("director_communication_recipients")
    .select("id", { count: "exact", head: true })
    .eq("communication_id", communicationId)
    .eq("delivery_status", "sent");

  const { count: failCount } = await admin
    .from("director_communication_recipients")
    .select("id", { count: "exact", head: true })
    .eq("communication_id", communicationId)
    .eq("delivery_status", "failed");

  const stillPending = (remainingPending || 0) + (remainingSending || 0);
  const successful_count = successCount || 0;
  const failed_count = failCount || 0;

  let status = "processing";
  let completed_at = null;
  if (stillPending === 0) {
    if (successful_count === 0 && failed_count > 0) status = "failed";
    else if (failed_count > 0) status = "partial_failure";
    else status = "completed";
    completed_at = new Date().toISOString();
  }

  await admin
    .from("director_communications")
    .update({ status, successful_count, failed_count, completed_at })
    .eq("id", communicationId);

  return {
    ok: true,
    batch_sent: sent,
    batch_failed: failed,
    remaining_pending: remainingPending || 0,
    remaining_sending: remainingSending || 0,
    successful_count,
    failed_count,
    status,
    done: stillPending === 0,
    claimed,
  };
}
