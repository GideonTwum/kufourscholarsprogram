import { NextResponse } from "next/server";
import { sendKspEmail } from "@/lib/email/send";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { panel_member_ids = [], subject, message } = body;
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "subject and message are required." }, { status: 400 });
  }
  if (!Array.isArray(panel_member_ids) || panel_member_ids.length === 0) {
    return NextResponse.json({ error: "Select at least one recipient." }, { status: 400 });
  }

  const { data: members, error: membErr } = await gate.supabase
    .from("panel_members")
    .select("id, email, full_name")
    .in("id", panel_member_ids);

  if (membErr) {
    return NextResponse.json({ error: "Failed to load panel members" }, { status: 500 });
  }

  let emails = [...new Set((members || []).map((m) => m.email?.trim()).filter(Boolean))];

  if (emails.length > 0) {
    const { data: inactivePortal } = await gate.supabase
      .from("profiles")
      .select("email")
      .eq("role", "panel")
      .eq("is_active", false)
      .in("email", emails);

    const blocked = new Set(
      (inactivePortal || []).map((p) => p.email?.trim().toLowerCase()).filter(Boolean)
    );
    emails = emails.filter((e) => !blocked.has(e.toLowerCase()));
  }

  if (emails.length === 0) {
    return NextResponse.json(
      {
        error:
          "No valid recipient emails (deactivated panel portal accounts are excluded from roster sends).",
      },
      { status: 400 }
    );
  }

  const html = `
    <div style="font-family: sans-serif; line-height: 1.5;">
      ${message.trim().replace(/\n/g, "<br/>")}
    </div>
  `;

  const send = await sendKspEmail({
    event: "director_panel_broadcast",
    to: emails,
    subject: subject.trim(),
    html,
    text: message.trim(),
    template: "panel_broadcast",
    directorId: gate.user.id,
  });

  await recordDirectorAudit({
    actor: gate.profile,
    action: "email.panel_broadcast",
    entityType: "email",
    entityId: null,
    newValue: {
      recipients: emails.length,
      subject: subject.trim(),
      ok: send.ok,
      skipped: send.skipped || false,
    },
    request,
    critical: false,
  });

  if (!send.ok) {
    return NextResponse.json(
      {
        error: "Email delivery failed or Resend / Edge Function not configured.",
        reason: send.reason || null,
        skipped: send.skipped || false,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, recipients: emails.length });
}
