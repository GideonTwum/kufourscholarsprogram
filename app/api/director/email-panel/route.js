import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendKspEmail } from "@/lib/email/send";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const { data: members, error: membErr } = await supabase
    .from("panel_members")
    .select("id, email, full_name")
    .in("id", panel_member_ids);

  if (membErr) {
    return NextResponse.json({ error: membErr.message }, { status: 500 });
  }

  const emails = [...new Set((members || []).map((m) => m.email?.trim()).filter(Boolean))];
  if (emails.length === 0) {
    return NextResponse.json({ error: "No valid recipient emails." }, { status: 400 });
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
    directorId: user.id,
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
