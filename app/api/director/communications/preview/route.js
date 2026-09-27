import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveDirector } from "@/lib/director-auth";
import {
  COMMUNICATION_AUDIENCE_LABELS,
  COMMUNICATION_PREVIEW_LIMIT,
  isValidCommunicationAudience,
  resolveCommunicationAudience,
  validateCommunicationContent,
} from "@/lib/director-communications";

/**
 * POST — resolve recipients for an audience (server-side only).
 * Body: { audience, application_id?, subject?, body?, offset? }
 * Does not send email. Does not trust client recipient lists.
 */
export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  // Optional content validation when previewing a composed message
  if (body.subject != null || body.body != null) {
    const contentErrors = validateCommunicationContent({
      subject: body.subject ?? "Preview",
      body: body.body ?? "Preview",
    });
    if (body.subject != null && contentErrors.subject) {
      return NextResponse.json({ error: contentErrors.subject, field_errors: contentErrors }, { status: 400 });
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const resolved = await resolveCommunicationAudience(admin, audience, applicationId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error || "Could not resolve audience." }, { status: 400 });
  }

  const offset = Math.max(0, Number(body.offset) || 0);
  const preview = resolved.sendable.slice(offset, offset + COMMUNICATION_PREVIEW_LIMIT).map((r) => ({
    application_id: r.application_id,
    full_name: r.full_name,
    university: r.university,
    status: r.status,
    email: r.email,
    workflow_label: r.workflow_label,
  }));

  return NextResponse.json({
    ok: true,
    audience,
    audience_label: COMMUNICATION_AUDIENCE_LABELS[audience] || audience,
    recipient_count: resolved.sendable.length,
    excluded_count: resolved.excluded.length,
    total_matched: resolved.totalMatched,
    preview,
    preview_offset: offset,
    preview_limit: COMMUNICATION_PREVIEW_LIMIT,
    has_more: offset + COMMUNICATION_PREVIEW_LIMIT < resolved.sendable.length,
    message: `${resolved.sendable.length} applicant${resolved.sendable.length === 1 ? "" : "s"} will receive this message.`,
    exclusion_message:
      resolved.excluded.length > 0
        ? `${resolved.excluded.length} applicant${resolved.excluded.length === 1 ? "" : "s"} excluded because no valid email address was available.`
        : null,
  });
}
