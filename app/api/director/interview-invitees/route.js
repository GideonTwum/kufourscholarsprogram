import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { INTERVIEW_SLOTS_TABLE } from "@/lib/director-interview-batches";
import {
  INTERVIEW_INVITEES_TABLE,
  fetchInterviewInvitees,
  inviteeDuplicateConflict,
  persistInviteeAssignments,
  presentSpecialInvitee,
  validateSpecialInviteeInput,
} from "@/lib/director-interview-invitees";
import { buildInviteeWhatsAppMessage } from "@/lib/director-interview-invitations";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import { ensureInterviewSchedule } from "@/lib/director-interview-schedule";

async function loadSlotsById(admin) {
  const { data } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, batch_name, interview_date, interview_time, end_time, capacity, published_at, invitation_sent_at, status, location");
  return Object.fromEntries((data || []).map((slot) => [slot.id, slot]));
}

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;
  const slotsById = await loadSlotsById(admin);
  const loaded = await fetchInterviewInvitees(admin, { slotsById });
  if (loaded.error) {
    return NextResponse.json({ error: loaded.error.message || "Failed to load invitees" }, { status: 500 });
  }
  return NextResponse.json({
    invitees: loaded.invitees,
    unavailable: loaded.unavailable === true,
    notify_applicants: false,
  });
}

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

  if (body.action === "allocate_batch") {
    return assignInvitees(admin, { body, gate, request });
  }
  if (body.action === "unallocate") {
    return unassignInvitees(admin, { body, gate, request });
  }

  const parsed = validateSpecialInviteeInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const insert = {
    ...parsed.value,
    created_by: gate.profile?.id || gate.user.id,
    interview_slot_id: null,
    published_at: null,
    invitation_sent_at: null,
    invitation_delivery_status: null,
  };
  const { data, error } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .insert(insert)
    .select("id, full_name, university, email")
    .single();
  if (error) {
    if (/email_normalized|duplicate|unique/i.test(error.message || "")) {
      return NextResponse.json({ error: "An invitee with this email already exists." }, { status: 409 });
    }
    if (/whatsapp/i.test(error.message || "")) {
      return NextResponse.json({ error: "An invitee with this WhatsApp number already exists." }, { status: 409 });
    }
    if (/42P01|PGRST205|does not exist|schema cache/i.test(error.message || "")) {
      return NextResponse.json(
        {
          error: "Special invitee storage is not available until the pending interview_special_invitees migration is applied.",
          code: "INVITEES_TABLE_MISSING",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message || "Could not save invitee" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview.invitee_created",
    entityType: INTERVIEW_INVITEES_TABLE,
    entityId: data.id,
    newValue: { full_name: data.full_name, university: data.university, email: data.email },
    metadata: { notify_applicants: false, source_type: "university_invitee" },
    request,
  });

  return NextResponse.json({
    success: true,
    invitee: data,
    notify_applicants: false,
  });
}

async function assignInvitees(admin, { body, gate, request }) {
  const slotId = typeof body.interview_slot_id === "string" ? body.interview_slot_id.trim() : "";
  const ids = [...new Set((body.invitee_ids || []).map((id) => String(id || "")).filter(Boolean))];
  const allowMove = body.allow_move === true;
  if (!slotId) return NextResponse.json({ error: "interview_slot_id required" }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Select at least one university invitee." }, { status: 400 });

  const { data: slot } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, batch_name, interview_date, interview_time, end_time, capacity, published_at, status")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot || slot.status === "cancelled") {
    return NextResponse.json({ error: "batch_not_found" }, { status: 404 });
  }
  const slotsById = { [slot.id]: slot };
  const { data: current } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select("id, interview_slot_id, published_at, invitation_sent_at, full_name")
    .in("id", ids);
  const conflicts = [];
  for (const row of current || []) {
    const conflict = inviteeDuplicateConflict(row, slotId, { allowMove, slotsById });
    if (conflict && conflict.reason !== "already_on_this_batch") {
      conflicts.push({ id: row.id, ...conflict });
    }
  }
  if (conflicts.length) {
    return NextResponse.json(
      { error: conflicts[0].reason, conflicts, notify_applicants: false },
      { status: 409 }
    );
  }

  if (body.confirm !== true) {
    return NextResponse.json({
      preview: { count: ids.length, batch_name: slot.batch_name },
      notify_applicants: false,
    });
  }

  const persisted = await persistInviteeAssignments(admin, {
    slotId,
    inviteeIds: ids,
    actorId: gate.profile?.id || gate.user.id,
    interviewFormat: body.interview_format === "virtual" ? "virtual" : "in_person",
    allowMove,
  });
  if (!persisted.ok) {
    return NextResponse.json(
      {
        error: persisted.error,
        available: persisted.available,
        needed: persisted.needed,
        skipped: persisted.skipped,
        notify_applicants: false,
      },
      { status: persisted.status || 409 }
    );
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview.invitee_assigned",
    entityType: INTERVIEW_INVITEES_TABLE,
    entityId: slotId,
    metadata: { count: persisted.assigned, notify_applicants: false },
    request,
  });

  return NextResponse.json({
    success: true,
    updated: persisted.assigned || ids.length,
    skipped: persisted.skipped || [],
    batch_name: slot.batch_name,
    notify_applicants: false,
  });
}

async function unassignInvitees(admin, { body, gate, request }) {
  const ids = [...new Set((body.invitee_ids || []).map((id) => String(id || "")).filter(Boolean))];
  if (!ids.length) return NextResponse.json({ error: "Select at least one university invitee." }, { status: 400 });
  const { data: current } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select("id, published_at, invitation_sent_at, full_name")
    .in("id", ids);
  if ((current || []).some((row) => row.published_at || row.invitation_sent_at)) {
    return NextResponse.json({ error: "published_locked", notify_applicants: false }, { status: 409 });
  }
  const { error } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .update({ interview_slot_id: null, updated_at: new Date().toISOString() })
    .in("id", ids)
    .is("published_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview.invitee_unassigned",
    entityType: INTERVIEW_INVITEES_TABLE,
    entityId: ids[0],
    metadata: { count: ids.length, notify_applicants: false },
    request,
  });
  return NextResponse.json({ success: true, updated: ids.length, notify_applicants: false });
}

export async function PATCH(request) {
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
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: existing, error: loadErr } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadErr || !existing) return NextResponse.json({ error: "Invitee not found" }, { status: 404 });

  if (body.action === "whatsapp_preview") {
    const slotsById = await loadSlotsById(admin);
    const slot = slotsById[existing.interview_slot_id] || null;
    const { data: setting } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", APPLICATION_CLASS_SETTING_KEY)
      .maybeSingle();
    const className =
      (typeof setting?.value === "string" && setting.value.trim()) || DEFAULT_APPLICATION_CLASS_NAME;
    const { schedule } = await ensureInterviewSchedule(admin, className);
    const origin = String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const confirmUrl = existing.access_token_hash ? null : null;
    const message = buildInviteeWhatsAppMessage({
      invitee: presentSpecialInvitee(existing, slotsById),
      schedule: schedule || {},
      slot,
      confirmUrl,
    });
    return NextResponse.json({
      message: message.text,
      waMe: message.waMe,
      sent: false,
      note: "The portal does not send WhatsApp messages. Open WhatsApp to send this yourself.",
    });
  }

  if (existing.published_at && body.full_name) {
    return NextResponse.json({ error: "published_locked" }, { status: 409 });
  }

  const parsed = validateSpecialInviteeInput({ ...existing, ...body });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { error } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, notify_applicants: false });
}
