import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendKspEmail } from "@/lib/email/send";
import {
  assertStatusTransition,
  normalizeApplicationStatus,
} from "@/lib/application-status-transition.mjs";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { escapeHtml, escapeHtmlWithBreaks } from "@/lib/email/escape";

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    batch_name,
    interview_date,
    interview_time,
    location,
    congratulations_message,
    meeting_link,
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

  let db;
  try {
    db = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const uniqueIds = [...new Set((application_ids || []).filter(Boolean))];

  const { data: slot, error: slotError } = await db
    .from("interview_slots")
    .insert({
      director_id: gate.user.id,
      batch_name,
      interview_date,
      interview_time,
      location,
      congratulations_message: congratulations_message || null,
      meeting_link: meeting_link || null,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (slotError) {
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
    },
    request,
  });

  if (!uniqueIds.length) {
    return NextResponse.json({ success: true, slot_id: slot.id, notified: 0 });
  }

  const { data: candidates, error: candErr } = await db
    .from("applications")
    .select("id, status, interview_slot_id")
    .in("id", uniqueIds);

  if (candErr) {
    return NextResponse.json(
      { error: "Batch created but could not load applicants", slot_id: slot.id },
      { status: 500 }
    );
  }

  const eligibleIds = [];
  const skipped = [];
  for (const row of candidates || []) {
    if (row.interview_slot_id && row.interview_slot_id !== slot.id) {
      skipped.push({ id: row.id, reason: "already_assigned_other_batch" });
      continue;
    }
    const current = normalizeApplicationStatus(row.status);
    // Primary queue: shortlisted (interview_review_pending). Allow re-attach for already scheduled.
    if (current === "interview_review_pending") {
      const err = assertStatusTransition(current, "called_for_interview");
      if (!err) eligibleIds.push(row.id);
      else skipped.push({ id: row.id, reason: "invalid_status_transition" });
      continue;
    }
    if (["called_for_interview", "interview"].includes(current)) {
      eligibleIds.push(row.id);
      continue;
    }
    // Exceptional one-off: Stage 2 approved without shortlist (secondary path)
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

  if (eligibleIds.length === 0) {
    return NextResponse.json(
      {
        error: "No applicants were eligible for interview assignment from their current status.",
        slot_id: slot.id,
        skipped,
      },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await db
    .from("applications")
    .update({
      interview_slot_id: slot.id,
      status: "called_for_interview",
      interview_date,
      interview_time,
      interview_location: location,
      updated_at: nowIso,
    })
    .in("id", eligibleIds);

  if (updateError) {
    return NextResponse.json(
      {
        error: "Slot created but assignment failed. Cancel or delete the partial batch.",
        slot_id: slot.id,
      },
      { status: 500 }
    );
  }

  const { data: rows } = await db
    .from("applications")
    .select("id, user_id, full_name, profiles!applications_user_id_fkey(email)")
    .in("id", eligibleIds)
    .eq("interview_slot_id", slot.id);

  const formattedDate =
    typeof interview_date === "string"
      ? new Date(interview_date + "T12:00:00").toLocaleDateString("en-GB", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : String(interview_date);

  for (const row of rows || []) {
    const name = row.full_name || "Applicant";
    const email = Array.isArray(row.profiles) ? row.profiles[0]?.email : row.profiles?.email;

    await gate.supabase.from("notifications").insert({
      user_id: row.user_id,
      title: "Interview batch scheduled",
      message: `${batch_name} — ${formattedDate} at ${interview_time}. Location: ${location}`,
      type: "interview_slot",
    });

    if (email) {
      await sendKspEmail({
        event: "interview_batch_assigned",
        to: email,
        subject: `Kufuor Scholars Program — Interview: ${batch_name}`,
        html: `
          <p>Dear ${escapeHtml(name)},</p>
          <p>You have been assigned to interview batch <strong>${escapeHtml(batch_name)}</strong>.</p>
          <ul>
            <li><strong>Date:</strong> ${escapeHtml(formattedDate)}</li>
            <li><strong>Time:</strong> ${escapeHtml(interview_time)}</li>
            <li><strong>Location:</strong> ${escapeHtml(location)}</li>
          </ul>
          ${
            congratulations_message
              ? `<p>${escapeHtmlWithBreaks(congratulations_message)}</p>`
              : ""
          }
          <p>Please sign in to the applicant dashboard for any updates.</p>
        `,
        text: `Interview batch ${batch_name} on ${formattedDate} at ${interview_time}. Location: ${location}`,
        template: "interview_batch",
        meta: { applicantName: name, batchName: batch_name },
      });
    }
  }

  return NextResponse.json({
    success: true,
    slot_id: slot.id,
    notified: (rows || []).length,
    skipped,
  });
}
