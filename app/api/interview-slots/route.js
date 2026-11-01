import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendKspEmail } from "@/lib/email/send";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import {
  assertStatusTransition,
  normalizeApplicationStatus,
} from "@/lib/application-status-transition.mjs";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import { ensureInterviewDayForDate, ensureInterviewSchedule } from "@/lib/director-interview-schedule";
import { INTERVIEW_ALLOCATION_TABLE } from "@/lib/director-interview-allocation";
import { INTERVIEW_SLOTS_TABLE } from "@/lib/director-interview-batches";
import {
  applyPublishedBatchWrites,
  compactInvitationPreview,
  deliverBatchInvitations,
  loadSlotAssignees,
  previewSlotPublication,
} from "@/lib/director-interview-publish";

async function loadSchedule(admin) {
  const { data } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", APPLICATION_CLASS_SETTING_KEY)
    .maybeSingle();
  const className =
    (typeof data?.value === "string" && data.value.trim()) || DEFAULT_APPLICATION_CLASS_NAME;
  const { schedule } = await ensureInterviewSchedule(admin, className);
  return { schedule: schedule || {}, className };
}

async function publishExistingSlot(admin, { slot, confirm, gate, request }) {
  const { schedule } = await loadSchedule(admin);
  const rows = await loadSlotAssignees(admin, slot);
  const preview = previewSlotPublication({ rows, schedule, slot });
  const compactPreview = compactInvitationPreview(preview, slot);
  if (confirm !== true) {
    return NextResponse.json({ preview: compactPreview, notify_applicants: true });
  }
  if (preview.blocked_count > 0) {
    return NextResponse.json({ error: "incomplete_batch", preview: compactPreview }, { status: 409 });
  }
  if (!preview.ready_count) {
    return NextResponse.json({ error: "nothing_to_publish", preview: compactPreview }, { status: 400 });
  }
  const nowIso = new Date().toISOString();
  await applyPublishedBatchWrites(admin, {
    slot,
    schedule,
    readyRows: preview.ready,
    nowIso,
  });
  const delivered = await deliverBatchInvitations({
    rows: preview.ready,
    schedule,
    slot,
    sendKspEmail,
    admin,
    notificationsInsert: async (row) => {
      await admin.from("notifications").insert(row);
    },
  });
  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview.batch_published",
    entityType: "interview_slot",
    entityId: slot.id,
    metadata: {
      notified: delivered.notified,
      skipped_duplicate: delivered.skippedDuplicate.length,
      failed: delivered.failed_count,
      event: "interview_batch_assigned",
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

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let db;
  try {
    db = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (body.publish === true) {
    const slotId = typeof body.slot_id === "string" ? body.slot_id.trim() : "";
    if (!slotId) return NextResponse.json({ error: "slot_id required to publish" }, { status: 400 });
    const { data: slot } = await db.from(INTERVIEW_SLOTS_TABLE).select("*").eq("id", slotId).maybeSingle();
    if (!slot || slot.status === "cancelled") {
      return NextResponse.json({ error: "Interview batch not found" }, { status: 404 });
    }
    return publishExistingSlot(db, { slot, confirm: body.confirm === true, gate, request });
  }

  const {
    batch_name,
    interview_date,
    interview_time,
    end_time,
    capacity,
    schedule_day_id,
    location,
    congratulations_message,
    meeting_link,
    interview_format,
    application_ids = [],
    allow_unshortlisted = false,
  } = body;

  if (!batch_name || !interview_date || !interview_time || !location) {
    return NextResponse.json(
      { error: "batch_name, interview_date, interview_time, and location are required" },
      { status: 400 }
    );
  }

  if (Number.isNaN(new Date(interview_date).getTime())) {
    return NextResponse.json({ error: "Invalid interview_date" }, { status: 400 });
  }

  const uniqueIds = [...new Set((application_ids || []).filter(Boolean))];
  let assignedCount = 0;
  let skipped = [];
  const { className } = await loadSchedule(db);
  const ensured = await ensureInterviewDayForDate(db, className, interview_date, {
    startTime: "08:00",
    endTime: "16:00",
  });
  const insert = {
    director_id: gate.user.id,
    batch_name,
    interview_date,
    interview_time,
    location,
    congratulations_message: congratulations_message || null,
    meeting_link: meeting_link || null,
    status: "scheduled",
    published_at: null,
  };
  if (end_time) insert.end_time = end_time;
  if (Number(capacity) > 0) insert.capacity = Number(capacity);
  if (schedule_day_id || ensured.day?.id) insert.schedule_day_id = schedule_day_id || ensured.day.id;

  let slot;
  let { data, error: slotError } = await db.from("interview_slots").insert(insert).select("id").single();
  if (slotError) {
    delete insert.end_time;
    delete insert.capacity;
    delete insert.schedule_day_id;
    delete insert.published_at;
    const fallback = await db.from("interview_slots").insert(insert).select("id").single();
    data = fallback.data;
    slotError = fallback.error;
  }
  slot = data;
  if (slotError || !slot) {
    return NextResponse.json({ error: "Failed to create interview batch" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview.batch_created",
    entityType: "interview_slot",
    entityId: slot.id,
    newValue: {
      batch_name,
      interview_date,
      interview_time,
      location,
      applicant_count: uniqueIds.length,
      notify_applicants: false,
    },
    request,
  });

  if (uniqueIds.length) {
    const { data: candidates } = await db
      .from("applications")
      .select("id, status, interview_slot_id")
      .in("id", uniqueIds);
    const eligibleIds = [];
    skipped = [];
    for (const row of candidates || []) {
      if (row.interview_slot_id && row.interview_slot_id !== slot.id) {
        skipped.push({ id: row.id, reason: "already_assigned_other_batch" });
        continue;
      }
      const current = normalizeApplicationStatus(row.status);
      if (current === "interview_review_pending") {
        eligibleIds.push(row.id);
        continue;
      }
      if (["called_for_interview", "interview"].includes(current)) {
        eligibleIds.push(row.id);
        continue;
      }
      if (current === "stage_2_approved" && allow_unshortlisted === true) {
        const err = assertStatusTransition(current, "called_for_interview");
        if (!err) eligibleIds.push(row.id);
        else skipped.push({ id: row.id, reason: "invalid_status_transition" });
        continue;
      }
      skipped.push({
        id: row.id,
        reason:
          current === "stage_2_approved"
            ? "not_shortlisted_use_shortlist_first"
            : "invalid_status_transition",
      });
    }
    if (!eligibleIds.length) {
      return NextResponse.json({
        success: true,
        slot_id: slot.id,
        notified: 0,
        assigned: 0,
        skipped,
        notify_applicants: false,
        warning: "Draft batch created. No eligible applicants were assigned.",
      });
    }
    const format = interview_format === "virtual" ? "virtual" : "in_person";
    const { data: assigned, error: assignErr } = await db.rpc("assign_interview_batch_applicants", {
      p_slot_id: slot.id,
      p_application_ids: eligibleIds,
      p_actor_id: gate.profile?.id || gate.user.id,
      p_interview_format: format,
    });
    if (assignErr) {
      const upserts = eligibleIds.map((application_id) => ({
        application_id,
        allocation_state: "physical",
        interview_slot_id: slot.id,
        interview_format: format,
        schedule_day_id: insert.schedule_day_id || null,
        updated_at: new Date().toISOString(),
      }));
      const fallback = await db
        .from(INTERVIEW_ALLOCATION_TABLE)
        .upsert(upserts, { onConflict: "application_id" });
      if (fallback.error) {
        return NextResponse.json({
          success: true,
          slot_id: slot.id,
          notified: 0,
          assigned: 0,
          skipped,
          notify_applicants: false,
          warning: "Draft batch created. Applicants were not assigned.",
        });
      }
      assignedCount = eligibleIds.length;
    } else if (assigned?.ok === false) {
      return NextResponse.json(
        {
          success: true,
          slot_id: slot.id,
          notified: 0,
          assigned: 0,
          skipped: assigned.skipped || skipped,
          error: assigned.error,
          available: assigned.available,
          notify_applicants: false,
          warning: "Draft batch created. Assignment was not completed.",
        },
        { status: assigned.error === "insufficient_batch_capacity" ? 409 : 200 }
      );
    } else {
      assignedCount = assigned?.assigned || eligibleIds.length;
      skipped = [...skipped, ...(assigned?.skipped || [])];
    }
  }

  return NextResponse.json({
    success: true,
    slot_id: slot.id,
    notified: 0,
    assigned: assignedCount,
    skipped,
    notify_applicants: false,
  });
}

// Invitation HTML escapes director copy with escapeHtmlWithBreaks(congratulations_message).
