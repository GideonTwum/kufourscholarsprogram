import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { COMMUNICATION_BATCH_SIZE } from "@/lib/director-communications";
import { processCommunicationBatch } from "@/lib/director-communications-send";

/**
 * POST — process the next delivery batch (Director only).
 * Idempotent: only pending recipients are attempted.
 */
export async function POST(request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: comm } = await admin
    .from("director_communications")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!comm) {
    return NextResponse.json({ error: "Communication not found." }, { status: 404 });
  }

  if (!["processing", "queued"].includes(comm.status)) {
    return NextResponse.json({
      ok: true,
      communication_id: id,
      status: comm.status,
      done: true,
      message: "Communication is already finished.",
    });
  }

  const batch = await processCommunicationBatch(admin, id, gate.user.id);

  if (batch.done) {
    await recordDirectorAudit({
      actor: gate.profile,
      action: batch.status === "failed" ? "communication.failed" : "communication.completed",
      entityType: "director_communication",
      entityId: id,
      newValue: {
        status: batch.status,
        successful_count: batch.successful_count,
        failed_count: batch.failed_count,
      },
      request,
      critical: false,
    });
  }

  return NextResponse.json({
    ok: true,
    communication_id: id,
    ...batch,
    batch_size: COMMUNICATION_BATCH_SIZE,
    continue_url: batch.done ? null : `/api/director/communications/${id}/continue`,
  });
}
