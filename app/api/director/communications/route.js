import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { COMMUNICATION_AUDIENCE_LABELS, COMMUNICATION_BATCH_SIZE } from "@/lib/director-communications";
import { processCommunicationBatch } from "@/lib/director-communications-send";
import {
  collectAttachmentFilesFromFormData,
  persistCommunicationAttachmentMetadata,
  storeDirectorCommunicationAttachments,
} from "@/lib/director-communication-attachment-store";
import {
  summarizeAttachmentDescriptors,
  validateDirectorCommunicationAttachments,
} from "@/lib/director-communication-attachments";

async function parseCommunicationRequest(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const confirmRaw = formData.get("confirm");
    const body = {
      confirm: confirmRaw === true || confirmRaw === "true" || confirmRaw === "1",
      audience: formData.get("audience"),
      application_id: formData.get("application_id"),
      subject: formData.get("subject"),
      body: formData.get("body"),
      idempotency_key: formData.get("idempotency_key"),
      emails: formData.get("emails"),
      recipients: formData.get("recipients"),
      to: formData.get("to"),
      recipient_emails: formData.get("recipient_emails"),
    };
    return { body, files: collectAttachmentFilesFromFormData(formData) };
  }
  const body = await request.json();
  return { body, files: [] };
}

/**
 * GET — list recent communications.
 */
export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("director_communications")
    .select(
      "id, audience_type, application_id, subject, status, recipient_count, successful_count, failed_count, excluded_count, created_by_name_snapshot, created_at, started_at, completed_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      {
        error: "Could not load communications. Ensure the communications migration is applied.",
        detail: error.message,
      },
      { status: 500 }
    );
  }

  const rows = (data || []).map((row) => ({
    ...row,
    audience_label: COMMUNICATION_AUDIENCE_LABELS[row.audience_type] || row.audience_type,
  }));

  return NextResponse.json({ ok: true, communications: rows });
}

/**
 * POST — create + begin sending (confirm: true required).
 * Client must NOT supply recipient emails.
 */
export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  let files = [];
  try {
    ({ body, files } = await parseCommunicationRequest(request));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Confirmation required. Set confirm: true after reviewing the audience." },
      { status: 400 }
    );
  }

  if (body.emails || body.recipients || body.to || body.recipient_emails) {
    return NextResponse.json(
      { error: "Client-provided recipient lists are not allowed." },
      { status: 400 }
    );
  }

  const {
    isValidCommunicationAudience,
    resolveCommunicationAudience,
    validateCommunicationContent,
  } = await import("@/lib/director-communications");

  const audience = typeof body.audience === "string" ? body.audience.trim() : "";
  if (!isValidCommunicationAudience(audience)) {
    return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
  }

  const applicationId =
    typeof body.application_id === "string" && body.application_id.trim()
      ? body.application_id.trim()
      : null;

  if (audience === "individual" && !applicationId) {
    return NextResponse.json(
      { error: "application_id is required for individual messages." },
      { status: 400 }
    );
  }

  const contentErrors = validateCommunicationContent({
    subject: body.subject,
    body: body.body,
  });
  if (Object.keys(contentErrors).length > 0) {
    return NextResponse.json(
      { error: Object.values(contentErrors)[0], field_errors: contentErrors },
      { status: 400 }
    );
  }

  const subject = String(body.subject).trim();
  const messageBody = String(body.body).trim();
  const idempotencyKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim().slice(0, 120)
      : null;

  if (files.length > 0) {
    const precheck = validateDirectorCommunicationAttachments(files.map((file) => ({ file })));
    if (!precheck.ok) {
      return NextResponse.json({ error: precheck.error, code: precheck.code || null }, { status: 400 });
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  if (idempotencyKey) {
    const { data: existing } = await admin
      .from("director_communications")
      .select("id, status, recipient_count, successful_count, failed_count")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({
        ok: true,
        communication_id: existing.id,
        status: existing.status,
        recipient_count: existing.recipient_count,
        successful_count: existing.successful_count,
        failed_count: existing.failed_count,
        deduplicated: true,
        done: !["processing", "queued"].includes(existing.status),
        message: "Existing communication returned for this idempotency key.",
      });
    }
  }

  const resolved = await resolveCommunicationAudience(admin, audience, applicationId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error || "Could not resolve audience." }, { status: 400 });
  }
  if (resolved.sendable.length === 0) {
    return NextResponse.json(
      {
        error: "No recipients with valid email addresses match this audience.",
        excluded_count: resolved.excluded.length,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: created, error: createErr } = await admin
    .from("director_communications")
    .insert({
      created_by: gate.user.id,
      created_by_name_snapshot: gate.profile?.full_name || null,
      created_by_email_snapshot: gate.profile?.email || gate.user.email || null,
      audience_type: audience,
      application_id: audience === "individual" ? applicationId : null,
      subject,
      body: messageBody,
      status: "processing",
      recipient_count: resolved.sendable.length,
      successful_count: 0,
      failed_count: 0,
      excluded_count: resolved.excluded.length,
      idempotency_key: idempotencyKey,
      started_at: now,
    })
    .select("id")
    .maybeSingle();

  if (createErr || !created?.id) {
    return NextResponse.json(
      {
        error: "Could not create communication record. Ensure the communications migration is applied.",
        detail: createErr?.message || null,
      },
      { status: 500 }
    );
  }

  let attachmentDescriptors = [];
  if (files.length > 0) {
    const stored = await storeDirectorCommunicationAttachments(admin, {
      directorId: gate.user.id,
      communicationId: created.id,
      files,
    });
    if (!stored.ok) {
      await admin
        .from("director_communications")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", created.id);
      return NextResponse.json(
        { error: stored.error, code: stored.code || null },
        { status: stored.code === "storage_unavailable" || stored.code === "schema_unavailable" ? 503 : 400 }
      );
    }
    const saved = await persistCommunicationAttachmentMetadata(admin, created.id, stored.attachments);
    if (!saved.ok) {
      await admin
        .from("director_communications")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", created.id);
      return NextResponse.json(
        { error: saved.error, code: saved.code || null },
        { status: saved.code === "schema_unavailable" ? 503 : 500 }
      );
    }
    attachmentDescriptors = stored.attachments;
  }

  const recipientRows = resolved.sendable.map((r) => ({
    communication_id: created.id,
    application_id: r.application_id || null,
    user_id: r.user_id || null,
    email: r.email,
    full_name_snapshot: r.full_name,
    university_snapshot: r.university || null,
    status_snapshot: r.status || r.source_label || null,
    delivery_status: "pending",
  }));

  for (let i = 0; i < recipientRows.length; i += 200) {
    const slice = recipientRows.slice(i, i + 200);
    const { error: recErr } = await admin.from("director_communication_recipients").insert(slice);
    if (recErr) {
      await admin
        .from("director_communications")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", created.id);
      return NextResponse.json(
        { error: "Could not store recipients.", detail: recErr.message },
        { status: 500 }
      );
    }
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "communication.sent",
    entityType: "director_communication",
    entityId: created.id,
    newValue: {
      audience,
      recipient_count: resolved.sendable.length,
      excluded_count: resolved.excluded.length,
      subject,
      attachment_count: attachmentDescriptors.length,
      attachments: summarizeAttachmentDescriptors(attachmentDescriptors),
      mutates_applications: false,
      mutates_interview_assignments: false,
    },
    request,
    critical: false,
  });

  const batch = await processCommunicationBatch(admin, created.id, gate.user.id);
  if (!batch.ok) {
    await admin
      .from("director_communications")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", created.id);
    return NextResponse.json(
      {
        error: batch.error || "Could not send this communication.",
        communication_id: created.id,
        status: "failed",
      },
      { status: 500 }
    );
  }

  if (batch.done) {
    await recordDirectorAudit({
      actor: gate.profile,
      action: batch.status === "failed" ? "communication.failed" : "communication.completed",
      entityType: "director_communication",
      entityId: created.id,
      newValue: {
        status: batch.status,
        successful_count: batch.successful_count,
        failed_count: batch.failed_count,
        attachment_count: attachmentDescriptors.length,
      },
      request,
      critical: false,
    });
  }

  return NextResponse.json({
    ok: true,
    communication_id: created.id,
    audience,
    audience_label: COMMUNICATION_AUDIENCE_LABELS[audience],
    recipient_count: resolved.sendable.length,
    excluded_count: resolved.excluded.length,
    attachment_count: attachmentDescriptors.length,
    attachments: summarizeAttachmentDescriptors(attachmentDescriptors),
    status: batch.status,
    successful_count: batch.successful_count,
    failed_count: batch.failed_count,
    remaining_pending: batch.remaining_pending,
    done: batch.done,
    batch_size: COMMUNICATION_BATCH_SIZE,
    continue_url: batch.done ? null : `/api/director/communications/${created.id}/continue`,
    message: batch.done
      ? `Communication finished: ${batch.successful_count} delivered, ${batch.failed_count} failed.`
      : `Sending in progress. ${batch.remaining_pending} remaining.`,
  });
}
