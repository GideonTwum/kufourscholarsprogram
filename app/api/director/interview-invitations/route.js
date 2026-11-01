import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { sendKspEmail } from "@/lib/email/send";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import { ensureInterviewSchedule } from "@/lib/director-interview-schedule";
import { INTERVIEW_SLOTS_TABLE } from "@/lib/director-interview-batches";
import {
  applyPublishedBatchWrites,
  compactInvitationPreview,
  deliverBatchInvitations,
  loadSlotAssignees,
  previewSlotPublication,
} from "@/lib/director-interview-publish";

/**
 * Batch publication via interview_slots. Individual appointment publication is disabled.
 */
export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slotId = typeof body.slot_id === "string" ? body.slot_id.trim() : "";
  if (!slotId) {
    return NextResponse.json(
      { error: "slot_id required. Individual appointment publication is disabled." },
      { status: 410 }
    );
  }

  const { data: slot } = await admin.from(INTERVIEW_SLOTS_TABLE).select("*").eq("id", slotId).maybeSingle();
  if (!slot || slot.status === "cancelled") {
    return NextResponse.json({ error: "batch_not_found" }, { status: 404 });
  }

  const { data: classSetting } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", APPLICATION_CLASS_SETTING_KEY)
    .maybeSingle();
  const className =
    (typeof classSetting?.value === "string" && classSetting.value.trim()) ||
    DEFAULT_APPLICATION_CLASS_NAME;
  const { schedule } = await ensureInterviewSchedule(admin, className);
  const rows = await loadSlotAssignees(admin, slot);
  const preview = previewSlotPublication({ rows, schedule: schedule || {}, slot });
  const compactPreview = compactInvitationPreview(preview, slot);

  if (body.confirm !== true) {
    return NextResponse.json({ preview: compactPreview, notify_applicants: true });
  }
  if (preview.blocked_count > 0) {
    return NextResponse.json(
      { error: "incomplete_batch", preview: compactPreview },
      { status: 409 }
    );
  }
  if (!preview.ready_count) {
    return NextResponse.json({ error: "nothing_to_publish", preview: compactPreview }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  await applyPublishedBatchWrites(admin, {
    slot,
    schedule: schedule || {},
    readyRows: preview.ready,
    nowIso,
  });
  const delivered = await deliverBatchInvitations({
    rows: preview.ready,
    schedule: schedule || {},
    slot,
    sendKspEmail,
    admin,
    notificationsInsert: async (row) => {
      await admin.from("notifications").insert(row);
    },
  });

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview_invitation.published",
    entityType: INTERVIEW_SLOTS_TABLE,
    entityId: slot.id,
    metadata: {
      notified: delivered.notified,
      skipped_duplicate: delivered.skippedDuplicate.length,
      failed: delivered.failed_count,
    },
    request,
  });

  return NextResponse.json({
    success: delivered.failed_count === 0,
    slot_id: slot.id,
    notified: delivered.notified,
    skipped_duplicate: delivered.skippedDuplicate.length,
    failed: delivered.failed,
    failed_count: delivered.failed_count,
    partial: delivered.partial,
    notify_applicants: true,
  });
}
