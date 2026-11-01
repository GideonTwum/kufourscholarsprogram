/**
 * Explicit interview_slots publication. Individual appointments are not published.
 * Invitation rows are marked sent only after sendKspEmail reports success.
 */

import { INTERVIEW_ALLOCATION_TABLE } from "./director-interview-allocation.js";
import {
  INTERVIEW_SLOTS_TABLE,
  applicationUpdateForPublishedBatch,
  isInterviewSlotPublished,
} from "./director-interview-batches.js";
import {
  buildInterviewInvitationEmail,
  previewInterviewInvitations,
} from "./director-interview-invitations.js";
import {
  INVITATION_DELIVERY_STATUSES,
  isInvitationAlreadySent,
  recordInvitationSendResult,
  summarizeInvitationDelivery,
} from "./director-interview-capacity.js";

export function compactInvitationPreview(preview, slot = null) {
  return {
    ready_count: preview.ready_count,
    blocked_count: preview.blocked_count,
    already_published: preview.already_published,
    retryable_count: preview.ready_count,
    missing_venue: preview.missing_venue,
    missing_whatsapp: preview.missing_whatsapp,
    dates: preview.dates,
    slot_id: slot?.id || null,
    ready: (preview.ready || []).map((row) => ({
      id: row.id,
      name: row.full_name,
      email: row.email || null,
      date: slot?.interview_date || row.slot?.interview_date || null,
      time: slot
        ? `${slot.interview_time || slot.start_time}${slot.end_time ? `–${slot.end_time}` : ""}`
        : null,
      format: row.allocation?.interview_format || "in_person",
      delivery_status: row.allocation?.invitation_delivery_status || null,
    })),
    blocked: preview.blocked,
  };
}

function syntheticLegacyAllocation(app, slot) {
  const legacyPublished =
    ["called_for_interview", "interview"].includes(app.status) && isInterviewSlotPublished(slot);
  return {
    interview_slot_id: slot.id,
    interview_format: "in_person",
    invitation_sent_at: legacyPublished ? slot.invitation_sent_at || slot.published_at : null,
    invitation_delivery_status: legacyPublished ? INVITATION_DELIVERY_STATUSES.sent : null,
  };
}

export async function loadSlotAssignees(admin, slot) {
  let { data: allocations, error: allocErr } = await admin
    .from(INTERVIEW_ALLOCATION_TABLE)
    .select(
      "application_id, interview_slot_id, appointment_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, invitation_delivery_status, invitation_last_error, response_status, schedule_day_id"
    )
    .eq("interview_slot_id", slot.id);
  if (allocErr) {
    const fallback = await admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .select(
        "application_id, interview_slot_id, appointment_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, response_status, schedule_day_id"
      )
      .eq("interview_slot_id", slot.id);
    allocations = fallback.data;
  }
  const allocationIds = (allocations || []).map((row) => row.application_id);
  const { data: assignedApps } = await admin
    .from("applications")
    .select("id, status, interview_slot_id")
    .eq("interview_slot_id", slot.id);
  const ids = [...new Set([...allocationIds, ...(assignedApps || []).map((row) => row.id)])];
  if (!ids.length) return [];
  const { data: applications } = await admin
    .from("applications")
    .select("id, status, full_name, interview_slot_id, user_id, profiles!applications_user_id_fkey(email, full_name)")
    .in("id", ids);
  const allocationById = new Map((allocations || []).map((row) => [row.application_id, row]));
  return (applications || []).map((app) => ({
    id: app.id,
    user_id: app.user_id,
    full_name: app.profiles?.full_name || app.full_name,
    email: app.profiles?.email || null,
    application: app,
    allocation: allocationById.get(app.id) || syntheticLegacyAllocation(app, slot),
    slot,
  }));
}

export async function applyPublishedBatchWrites(admin, { slot, schedule, readyRows, nowIso }) {
  for (const row of readyRows) {
    if (isInvitationAlreadySent(row)) continue;
    const appPatch = applicationUpdateForPublishedBatch({
      slot,
      schedule,
      allocation: row.allocation,
    });
    await admin
      .from("applications")
      .update({ ...appPatch, updated_at: nowIso })
      .eq("id", row.id)
      .in("status", ["stage_2_approved", "interview_review_pending", "called_for_interview"]);

    const upsert = {
      application_id: row.id,
      interview_slot_id: slot.id,
      allocation_state: "physical",
      schedule_day_id: slot.schedule_day_id || row.allocation?.schedule_day_id || null,
      interview_format: row.allocation?.interview_format || "in_person",
      meeting_link: row.allocation?.meeting_link || slot.meeting_link || null,
      meeting_instructions: row.allocation?.meeting_instructions || null,
      published_at: row.allocation?.published_at || nowIso,
      invitation_sent_at: null,
      invitation_delivery_status: INVITATION_DELIVERY_STATUSES.pending,
      invitation_last_error: null,
      response_status: row.allocation?.response_status || "awaiting_response",
      updated_at: nowIso,
    };
    const withStatus = await admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .upsert(upsert, { onConflict: "application_id" });
    if (withStatus.error) {
      delete upsert.invitation_delivery_status;
      delete upsert.invitation_last_error;
      await admin.from(INTERVIEW_ALLOCATION_TABLE).upsert(upsert, { onConflict: "application_id" });
    }
  }

  await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .update({
      published_at: slot.published_at || nowIso,
      updated_at: nowIso,
    })
    .eq("id", slot.id);
}

async function markInvitationDelivery(admin, applicationId, result) {
  const patch = {
    invitation_sent_at: result.invitation_sent_at,
    invitation_delivery_status: result.invitation_delivery_status,
    invitation_last_error: result.invitation_last_error,
    updated_at: new Date().toISOString(),
  };
  const first = await admin.from(INTERVIEW_ALLOCATION_TABLE).update(patch).eq("application_id", applicationId);
  if (first.error) {
    await admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .update({
        invitation_sent_at: result.invitation_sent_at,
        updated_at: patch.updated_at,
      })
      .eq("application_id", applicationId);
  }
}

export async function deliverBatchInvitations({
  rows,
  schedule,
  slot,
  sendKspEmail,
  notificationsInsert,
  admin = null,
}) {
  let notified = 0;
  const skippedDuplicate = [];
  const failed = [];
  for (const row of rows) {
    if (isInvitationAlreadySent(row)) {
      skippedDuplicate.push(row.id);
      continue;
    }
    const email = buildInterviewInvitationEmail({
      applicantName: row.full_name,
      allocation: row.allocation,
      schedule,
      slot,
    });
    let sendResult = { ok: false, sent: false, reason: "missing_email" };
    if (row.email) {
      sendResult = await sendKspEmail({
        event: email.event,
        to: row.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        template: email.template,
        meta: { applicationId: row.id, slotId: slot.id },
      });
    }
    const recorded = recordInvitationSendResult(row.allocation || {}, {
      ...sendResult,
      sentAt: new Date().toISOString(),
    });
    if (admin) await markInvitationDelivery(admin, row.id, recorded);
    if (recorded.duplicate) {
      skippedDuplicate.push(row.id);
      continue;
    }
    if (recorded.invitation_delivery_status === INVITATION_DELIVERY_STATUSES.sent) {
      notified += 1;
      if (row.user_id && notificationsInsert) {
        await notificationsInsert({
          user_id: row.user_id,
          title: "Interview invitation",
          message: email.text,
          type: "interview_slot",
        });
      }
    } else {
      failed.push({
        id: row.id,
        name: row.full_name,
        reason: recorded.invitation_last_error || "send_failed",
      });
    }
  }
  return {
    notified,
    skippedDuplicate,
    failed,
    failed_count: failed.length,
    partial: failed.length > 0 && notified > 0,
  };
}

export function previewSlotPublication({ rows, schedule, slot }) {
  return previewInterviewInvitations({ rows, schedule, slot });
}

export { summarizeInvitationDelivery };
