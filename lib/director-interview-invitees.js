/**
 * University special invitees are not applications.
 * They occupy interview_slots capacity alongside regular applicants.
 */

import crypto from "crypto";
import { presentApplicantAssignment, assignmentRowState } from "./director-interview-assignment.js";
import { INTERVIEW_SLOTS_TABLE, occupancyFromRows } from "./director-interview-batches.js";
import { mapAssignmentRpcResult } from "./director-interview-capacity.js";
import { INTERVIEW_ALLOCATION_TABLE } from "./director-interview-allocation.js";

export const INTERVIEW_INVITEES_TABLE = "interview_special_invitees";
export const UNIVERSITY_INVITEE_SOURCE = "university_invitee";
export const UNIVERSITY_INVITEE_LABEL = "University Invitee";
export const OFFICIAL_INTERVIEW_WHATSAPP = "0246672876";
export const INVITEE_TOKEN_TTL_DAYS = 45;

export const INVITEE_SELECT =
  "id, full_name, university, email, email_normalized, whatsapp_phone, whatsapp_e164, nationality, programme_of_study, source_type, interview_slot_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, invitation_delivery_status, invitation_last_error, response_status, response_reason, access_token_expires_at, created_at, updated_at";

export function isMissingInviteeRelation(error) {
  const text = `${error?.code || ""} ${error?.message || ""} ${error?.details || ""}`;
  return /42P01|PGRST205|does not exist|schema cache/i.test(text);
}

export function normalizeInviteeEmail(raw) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "A valid email address is required." };
  }
  return { ok: true, email };
}

export function normalizeWhatsAppPhone(raw) {
  const display = String(raw || "").trim();
  if (!display) return { ok: false, error: "WhatsApp number is required." };
  const nums = display.replace(/\D/g, "");
  if (nums.length < 8 || nums.length > 15) {
    return { ok: false, error: "Enter a WhatsApp number with country code, for example +233246672876." };
  }
  let e164 = nums;
  if (nums.startsWith("0") && nums.length === 10) e164 = `233${nums.slice(1)}`;
  return {
    ok: true,
    display,
    e164,
    waMe: `https://wa.me/${e164}`,
  };
}

export function validateSpecialInviteeInput(body = {}) {
  const full_name = String(body.full_name || "").trim();
  const university = String(body.university || "").trim();
  const nationality = String(body.nationality || "").trim();
  const programme = String(body.programme_of_study || body.programme || "").trim();
  const email = normalizeInviteeEmail(body.email);
  const phone = normalizeWhatsAppPhone(body.whatsapp_phone || body.whatsapp || body.phone);
  if (full_name.length < 2) return { ok: false, error: "Full name is required." };
  if (university.length < 2) return { ok: false, error: "University is required." };
  if (!email.ok) return email;
  if (!phone.ok) return phone;
  return {
    ok: true,
    value: {
      full_name: full_name.slice(0, 160),
      university: university.slice(0, 160),
      email: email.email,
      email_normalized: email.email,
      whatsapp_phone: phone.display.slice(0, 40),
      whatsapp_e164: phone.e164,
      nationality: nationality ? nationality.slice(0, 80) : null,
      programme_of_study: programme ? programme.slice(0, 160) : null,
      source_type: UNIVERSITY_INVITEE_SOURCE,
    },
  };
}

export function hashInviteeAccessToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function createInviteeAccessToken(now = new Date(), ttlDays = INVITEE_TOKEN_TTL_DAYS) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  return {
    token,
    token_hash: hashInviteeAccessToken(token),
    expires_at: expires.toISOString(),
  };
}

export function inviteeAccessTokenIsValid(invitee, now = new Date()) {
  if (!invitee?.access_token_hash) return false;
  if (!invitee.access_token_expires_at) return false;
  return new Date(invitee.access_token_expires_at).getTime() > now.getTime();
}

export function tokensMatch(storedHash, providedToken) {
  const expected = Buffer.from(String(storedHash || ""), "utf8");
  const actual = Buffer.from(hashInviteeAccessToken(providedToken), "utf8");
  if (expected.length !== actual.length || expected.length === 0) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function presentSpecialInvitee(row, slotsById = {}) {
  const assignment = presentApplicantAssignment(
    { interview_slot_id: null },
    {
      interview_slot_id: row?.interview_slot_id || null,
      published_at: row?.published_at || row?.invitation_sent_at || null,
    },
    slotsById
  );
  return {
    id: row.id,
    source_kind: "invitee",
    source_label: UNIVERSITY_INVITEE_LABEL,
    full_name: row.full_name,
    applicant_name: row.full_name,
    university: row.university,
    email: row.email,
    whatsapp_phone: row.whatsapp_phone,
    whatsapp_e164: row.whatsapp_e164,
    nationality: row.nationality || null,
    programme_of_study: row.programme_of_study || null,
    interview_format: row.interview_format || "in_person",
    response_status: row.response_status || null,
    response_reason: row.response_reason || null,
    invitation_sent_at: row.invitation_sent_at || null,
    invitation_delivery_status: row.invitation_delivery_status || null,
    invitation_last_error: row.invitation_last_error || null,
    published_at: row.published_at || null,
    ...assignment,
    assigned_published: Boolean(row.published_at || row.invitation_sent_at),
  };
}

export function inviteeSelectionKey(id) {
  return `i:${id}`;
}

export function applicantSelectionKey(id) {
  return `a:${id}`;
}

export function parseSelectionKeys(keys = []) {
  const application_ids = [];
  const invitee_ids = [];
  for (const raw of keys || []) {
    const key = String(raw || "");
    if (key.startsWith("i:")) invitee_ids.push(key.slice(2));
    else if (key.startsWith("a:")) application_ids.push(key.slice(2));
    else if (key) application_ids.push(key);
  }
  return { application_ids, invitee_ids };
}

export function planCombinedBatchOccupancy({
  slot,
  bookedApplicants = 0,
  bookedInvitees = 0,
  selectedApplicantIds = [],
  selectedInviteeIds = [],
} = {}) {
  const applicantIds = [...new Set(selectedApplicantIds.filter(Boolean))];
  const inviteeIds = [...new Set(selectedInviteeIds.filter(Boolean))];
  const needed = applicantIds.length + inviteeIds.length;
  const booked = Number(bookedApplicants || 0) + Number(bookedInvitees || 0);
  const capacity = Number(slot?.capacity) > 0 ? Number(slot.capacity) : 0;
  const available = Math.max(0, capacity - booked);
  if (!slot?.id) return { ok: false, error: "missing_batch", needed, available: 0 };
  if (!needed) return { ok: false, error: "no_selection", needed: 0, available };
  if (needed > available) {
    return {
      ok: false,
      error: "insufficient_batch_capacity",
      needed,
      available,
      booked,
      capacity,
      applicant_count: applicantIds.length,
      invitee_count: inviteeIds.length,
    };
  }
  return {
    ok: true,
    needed,
    available: available - needed,
    booked,
    capacity,
    applicant_count: applicantIds.length,
    invitee_count: inviteeIds.length,
    notify_applicants: false,
  };
}

export function summarizeInviteeCounts(invitees = []) {
  const total = invitees.length;
  const assigned = invitees.filter((row) => row.assigned_slot_id || row.interview_slot_id).length;
  return {
    total,
    assigned,
    unassigned: total - assigned,
  };
}

export function occupancyIncludingInvitees(applicantRows = [], inviteeRows = []) {
  return occupancyFromRows([
    ...(applicantRows || []),
    ...(inviteeRows || []).map((row) => ({
      id: `invitee:${row.id || row.application_id}`,
      interview_slot_id: row.interview_slot_id,
    })),
  ]);
}

export function inviteeDuplicateConflict(invitee, destinationSlotId, { allowMove = false, slotsById = {} } = {}) {
  const presented = presentSpecialInvitee(invitee, slotsById);
  const row = assignmentRowState(presented, destinationSlotId);
  if (row.kind === "unassigned" || row.kind === "this_batch") return null;
  if (row.kind === "other_batch" && allowMove && !presented.assigned_published) return null;
  return {
    reason: presented.assigned_published ? "published_locked" : "already_assigned_other_batch",
    assigned_slot_id: presented.assigned_slot_id,
    assigned_batch_label: presented.assigned_batch_label,
  };
}

export function shouldIssueInviteeToken(invitee) {
  if (!invitee) return true;
  if (invitee.invitation_sent_at || invitee.invitation_delivery_status === "sent") return false;
  return true;
}

export async function fetchInterviewInvitees(admin, { slotsById = {} } = {}) {
  const { data, error } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select(INVITEE_SELECT)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingInviteeRelation(error)) return { invitees: [], unavailable: true, error: null };
    return { invitees: [], unavailable: false, error };
  }
  return {
    invitees: (data || []).map((row) => presentSpecialInvitee(row, slotsById)),
    unavailable: false,
    error: null,
    raw: data || [],
  };
}

export async function persistInviteeAssignments(admin, { slotId, inviteeIds, actorId, interviewFormat, allowMove }) {
  const { data, error } = await admin.rpc("assign_interview_batch_invitees", {
    p_slot_id: slotId,
    p_invitee_ids: inviteeIds,
    p_actor_id: actorId || null,
    p_interview_format: interviewFormat || "in_person",
    p_allow_move: allowMove === true,
  });
  const mapped = mapAssignmentRpcResult(data, error);
  if (mapped.error === "BATCH_LOCK_UNAVAILABLE") {
    return persistInviteeAssignmentsFallback(admin, {
      slotId,
      inviteeIds,
      actorId,
      interviewFormat,
      allowMove,
    });
  }
  return mapped;
}

async function persistInviteeAssignmentsFallback(admin, { slotId, inviteeIds, actorId, interviewFormat, allowMove }) {
  const nowIso = new Date().toISOString();
  const { data: slot } = await admin
    .from(INTERVIEW_SLOTS_TABLE)
    .select("id, capacity, status")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot || slot.status === "cancelled") {
    return { ok: false, error: "batch_not_found", status: 404 };
  }
  const { data: rows, error } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select("id, interview_slot_id, published_at, invitation_sent_at")
    .in("id", inviteeIds);
  if (error) return { ok: false, error: error.message, status: 500 };
  const skipped = [];
  const assignable = [];
  for (const row of rows || []) {
    if (row.published_at || row.invitation_sent_at) {
      skipped.push({ id: row.id, reason: "published_locked" });
      continue;
    }
    if (row.interview_slot_id && row.interview_slot_id !== slotId && !allowMove) {
      skipped.push({ id: row.id, reason: "already_assigned_other_batch" });
      continue;
    }
    assignable.push(row.id);
  }
  if (skipped.length && assignable.length === 0) {
    return { ok: false, error: skipped[0].reason, skipped, status: 409 };
  }
  const { data: allocs } = await admin
    .from(INTERVIEW_ALLOCATION_TABLE)
    .select("application_id, interview_slot_id")
    .eq("interview_slot_id", slotId);
  const { data: apps } = await admin
    .from("applications")
    .select("id, interview_slot_id")
    .eq("interview_slot_id", slotId);
  const { data: currentInvitees } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select("id, interview_slot_id")
    .eq("interview_slot_id", slotId);
  const assignableSet = new Set(assignable);
  const occupancy = occupancyIncludingInvitees(
    [
      ...(allocs || []).map((row) => ({ id: row.application_id, interview_slot_id: slotId })),
      ...(apps || []).map((row) => ({ id: row.id, interview_slot_id: slotId })),
    ],
    (currentInvitees || []).filter((row) => !assignableSet.has(row.id))
  );
  const booked = occupancy[slotId] || 0;
  const planned = planCombinedBatchOccupancy({
    slot,
    bookedApplicants: booked,
    bookedInvitees: 0,
    selectedInviteeIds: assignable,
  });
  if (!planned.ok) {
    return { ok: false, error: planned.error, available: planned.available, needed: planned.needed, skipped, status: 409 };
  }
  if (assignable.length) {
    const { error: updateErr } = await admin
      .from(INTERVIEW_INVITEES_TABLE)
      .update({
        interview_slot_id: slotId,
        interview_format: interviewFormat === "virtual" ? "virtual" : "in_person",
        updated_at: nowIso,
      })
      .in("id", assignable)
      .is("published_at", null);
    if (updateErr) return { ok: false, error: updateErr.message, status: 500 };
  }
  return { ok: true, assigned: assignable.length, skipped, notify_applicants: false };
}

export function officialWhatsAppDisplay(schedule = {}) {
  return String(schedule.whatsapp_contact || "").trim() || OFFICIAL_INTERVIEW_WHATSAPP;
}
