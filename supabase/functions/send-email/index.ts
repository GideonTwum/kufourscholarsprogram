const RESEND_API = "https://api.resend.com/emails";

type Body = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  meta?: Record<string, string>;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey");
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorized = serviceKey && (bearer === serviceKey || apikey === serviceKey);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") ?? "Kufuor Scholars <onboarding@resend.dev>";
  if (!key) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  const { to, subject, html, text, template, meta = {} } = body;
  const recipients = Array.isArray(to) ? to : to ? [to] : [];
  if (recipients.length === 0 || !subject) {
    return new Response(JSON.stringify({ error: "Missing to or subject" }), { status: 400 });
  }

  let finalHtml = html;
  let finalText = text;

  if (template === "stage1_approved") {
    const name = meta.applicantName ?? "Applicant";
    finalHtml = `<p>Dear ${escapeHtml(name)},</p>
<p>Congratulations, your Stage 1 application has been approved. You may now proceed to the next stage.</p>
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
    finalText = `Congratulations, ${name}. Your Stage 1 application has been approved. You may now proceed to the next stage.`;
  } else if (template === "stage2_approved") {
    const name = meta.applicantName ?? "Applicant";
    finalHtml = `<p>Dear ${escapeHtml(name)},</p>
<p>Congratulations, your Stage 2 application has been approved. Please check your dashboard for the next step.</p>
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
    finalText = `Congratulations, ${name}. Your Stage 2 application has been approved. Please check your dashboard for the next step.`;
  } else if (template === "interview_invite") {
    const name = escapeHtml(meta.applicantName ?? "Applicant");
    finalHtml = `<p>Dear ${name},</p>
<p>You have been <strong>called for an interview</strong> with the Kufuor Scholars Program.</p>
<ul>
<li><strong>Date:</strong> ${escapeHtml(meta.interviewDate ?? "—")}</li>
<li><strong>Time:</strong> ${escapeHtml(meta.interviewTime ?? "—")}</li>
<li><strong>Location / link:</strong> ${escapeHtml(meta.interviewLocation ?? "—")}</li>
</ul>
<p><strong>Instructions:</strong></p>
<p>${escapeHtml(meta.interviewInstructions ?? "Please arrive 15 minutes early.")}</p>
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
    finalText =
      `Interview: ${meta.interviewDate ?? ""} at ${meta.interviewTime ?? ""}. Location: ${meta.interviewLocation ?? ""}. ${meta.interviewInstructions ?? ""}`;
  } else if (template === "rejection_notice") {
    const name = meta.applicantName ?? "Applicant";
    finalHtml = `<p>Dear ${escapeHtml(name)},</p><p>${escapeHtml(meta.message ?? "We regret we cannot proceed with your application at this time.")}</p>`;
    finalText = meta.message ?? "";
  } else if (template === "panel_broadcast") {
    finalHtml = html ?? `<pre>${escapeHtml(text ?? "")}</pre>`;
    finalText = text ?? "";
  }

  if (!finalHtml && !finalText) {
    return new Response(JSON.stringify({ error: "No content" }), { status: 400 });
  }

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html: finalHtml ?? `<pre>${escapeHtml(finalText ?? "")}</pre>`,
      text: finalText ?? "",
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return new Response(JSON.stringify({ error: json }), { status: 502 });
  }
  return new Response(JSON.stringify({ success: true, id: json.id }), {
    headers: { "Content-Type": "application/json" },
  });
});

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
