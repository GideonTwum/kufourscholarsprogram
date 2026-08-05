import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { sendKspEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape";

async function loadSlot(admin, id) {
  const { data, error } = await admin.from("interview_slots").select("*").eq("id", id).maybeSingle();
  if (error) return { error };
  return { slot: data };
}

/**
 * PATCH — reschedule / update / cancel interview batch
 * Body: { action?: "cancel"|"complete", batch_name?, interview_date?, interview_time?, location?, meeting_link?, congratulations_message? }
 */
export async function PATCH(request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { slot, error: loadErr } = await loadSlot(admin, id);
  if (loadErr) return NextResponse.json({ error: "Failed to load slot" }, { status: 500 });
  if (!slot) return NextResponse.json({ error: "Interview batch not found" }, { status: 404 });

  const nowIso = new Date().toISOString();
  const patch = { updated_at: nowIso };

  if (body.action === "cancel") {
    if (slot.status === "cancelled") {
      return NextResponse.json({ error: "Batch already cancelled" }, { status: 409 });
    }
    patch.status = "cancelled";
    patch.cancelled_at = nowIso;
  } else if (body.action === "complete") {
    patch.status = "completed";
    patch.completed_at = nowIso;
  } else {
    if (body.batch_name != null) patch.batch_name = String(body.batch_name).trim();
    if (body.interview_date != null) patch.interview_date = body.interview_date;
    if (body.interview_time != null) patch.interview_time = String(body.interview_time).trim();
    if (body.location != null) patch.location = String(body.location).trim();
    if (body.meeting_link != null) patch.meeting_link = String(body.meeting_link).trim() || null;
    if (body.congratulations_message != null) {
      patch.congratulations_message = String(body.congratulations_message).trim() || null;
    }
    if (patch.interview_date && Number.isNaN(new Date(patch.interview_date).getTime())) {
      return NextResponse.json({ error: "Invalid interview_date" }, { status: 400 });
    }
  }

  const { error: updErr } = await admin.from("interview_slots").update(patch).eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: "Failed to update interview batch" }, { status: 500 });
  }

  if (body.action === "complete") {
    const { data: appsToComplete } = await admin
      .from("applications")
      .select("id, status")
      .eq("interview_slot_id", id)
      .eq("status", "called_for_interview");

    const completeIds = (appsToComplete || []).map((a) => a.id);
    if (completeIds.length) {
      await admin
        .from("applications")
        .update({ status: "interview", updated_at: nowIso })
        .in("id", completeIds);
    }

    await recordDirectorAudit({
      actor: gate.profile,
      action: "interview.batch_completed",
      entityType: "interview_slot",
      entityId: id,
      oldValue: { status: slot.status },
      newValue: { status: "completed", applicants_advanced: completeIds.length },
      request,
    });

    return NextResponse.json({
      success: true,
      action: "complete",
      applicants_advanced: completeIds.length,
    });
  }

  if (body.action === "cancel") {
    const { data: appsToReturn } = await admin
      .from("applications")
      .select("id, status")
      .eq("interview_slot_id", id)
      .in("status", ["called_for_interview", "interview"]);

    const returnIds = (appsToReturn || []).map((a) => a.id);
    if (returnIds.length) {
      await admin
        .from("applications")
        .update({
          status: "interview_review_pending",
          interview_slot_id: null,
          interview_date: null,
          interview_time: null,
          interview_location: null,
          interview_instructions: null,
          updated_at: nowIso,
        })
        .in("id", returnIds);
    }
  }

  const action =
    body.action === "cancel"
      ? "interview.batch_cancelled"
      : "interview.batch_updated";

  await recordDirectorAudit({
    actor: gate.profile,
    action,
    entityType: "interview_slot",
    entityId: id,
    oldValue: {
      status: slot.status,
      interview_date: slot.interview_date,
      interview_time: slot.interview_time,
      location: slot.location,
    },
    newValue: patch,
    request,
  });

  // Notify applicants on cancel or reschedule
  if (body.action === "cancel" || body.interview_date || body.interview_time || body.location) {
    const { data: apps } = await admin
      .from("applications")
      .select("id, user_id, full_name, profiles!applications_user_id_fkey(email)")
      .eq("interview_slot_id", id);

    for (const app of apps || []) {
      const email = Array.isArray(app.profiles) ? app.profiles[0]?.email : app.profiles?.email;
      const name = app.full_name || "Applicant";
      if (app.user_id) {
        await gate.supabase.from("notifications").insert({
          user_id: app.user_id,
          title: body.action === "cancel" ? "Interview cancelled" : "Interview updated",
          message:
            body.action === "cancel"
              ? "Your interview batch has been cancelled. Check your email for details."
              : "Your interview schedule has been updated. Check your email for details.",
          type: "interview_slot",
        });
      }
      if (email) {
        await sendKspEmail({
          event: body.action === "cancel" ? "interview_batch_cancelled" : "interview_batch_updated",
          to: email,
          subject:
            body.action === "cancel"
              ? "Kufuor Scholars — Interview cancelled"
              : "Kufuor Scholars — Interview updated",
          html: `<p>Dear ${escapeHtml(name)},</p><p>${
            body.action === "cancel"
              ? "Your interview batch has been cancelled. The program team will contact you with next steps."
              : "Your interview details have been updated. Please sign in to the applicant portal for the latest information."
          }</p>`,
          text:
            body.action === "cancel"
              ? "Your interview batch has been cancelled."
              : "Your interview details have been updated.",
          template: "interview_batch_change",
        });
      }
    }
  }

  return NextResponse.json({ success: true, action: body.action || "update" });
}

/**
 * DELETE — only allowed when no applicants are linked, or after cancel + explicit force
 */
export async function DELETE(request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { id } = await params;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  const { slot, error: loadErr } = await loadSlot(admin, id);
  if (loadErr) return NextResponse.json({ error: "Failed to load slot" }, { status: 500 });
  if (!slot) return NextResponse.json({ error: "Interview batch not found" }, { status: 404 });

  const { count } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("interview_slot_id", id);

  if ((count || 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a batch with assigned applicants. Cancel the batch or remove applicants first.",
      },
      { status: 409 }
    );
  }

  const { error: delErr } = await admin.from("interview_slots").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "interview.batch_deleted",
    entityType: "interview_slot",
    entityId: id,
    oldValue: { batch_name: slot.batch_name, status: slot.status },
    request,
  });

  return NextResponse.json({ success: true });
}
