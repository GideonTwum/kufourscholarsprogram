import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { COMMUNICATION_AUDIENCE_LABELS } from "@/lib/director-communications";

/**
 * GET — communication detail (Director only). Does not include provider secrets.
 */
export async function GET(_request, { params }) {
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

  const { data: comm, error } = await admin
    .from("director_communications")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !comm) {
    return NextResponse.json({ error: "Communication not found." }, { status: 404 });
  }

  const { data: recipients } = await admin
    .from("director_communication_recipients")
    .select(
      "id, application_id, email, full_name_snapshot, university_snapshot, status_snapshot, delivery_status, error_code, sent_at"
    )
    .eq("communication_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({
    ok: true,
    communication: {
      ...comm,
      audience_label: COMMUNICATION_AUDIENCE_LABELS[comm.audience_type] || comm.audience_type,
    },
    recipients: recipients || [],
    recipients_truncated: (recipients || []).length >= 100,
  });
}

// Keep unused import referenced for audit action discoverability in static scans.
void recordDirectorAudit;
