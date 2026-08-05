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
  if (!key) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fromResolved = resolveEmailFrom();
  if (fromResolved.error) {
    return new Response(
      JSON.stringify({
        error: fromResolved.error,
        message: "EMAIL_FROM is required for sending. Set the Edge secret EMAIL_FROM.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const from = fromResolved.from;

  const { to, subject, html, text, template, meta = {} } = body;
  const recipients = Array.isArray(to) ? to : to ? [to] : [];
  if (recipients.length === 0 || !subject) {
    return new Response(JSON.stringify({ error: "Missing to or subject" }), { status: 400 });
  }

  let finalHtml = html;
  let finalText = text;

  if (template === "stage1_submitted") {
    const name = meta.applicantName ?? "Applicant";
    finalHtml = `<p>Dear ${escapeHtml(name)},</p>
<p>Thank you for submitting your Stage 1 application. Your status is <strong>Pending</strong> while we review your file.</p>
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
    finalText = `Thank you, ${name}. Your Stage 1 application was received and is pending review.`;
  } else if (template === "stage1_approved") {
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
  } else if (template === "accepted") {
    const name = meta.applicantName ?? "Scholar";
    finalHtml = `<p>Dear ${escapeHtml(name)},</p>
<p><strong>Congratulations!</strong> Your application to the Kufuor Scholars Program has been accepted.</p>
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
    finalText = `Congratulations ${name}, your application has been accepted.`;
  } else if (template === "rejected") {
    const name = meta.applicantName ?? "Applicant";
    const reason = meta.reason ? `<p><strong>Reason:</strong> ${escapeHtml(meta.reason)}</p>` : "";
    finalHtml = `<p>Dear ${escapeHtml(name)},</p>
<p>Thank you for your interest. After careful review, we are unable to offer you a place at this time.</p>
${reason}
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
    finalText = meta.reason
      ? `Application update. ${meta.reason}`
      : "Thank you for your interest in the Kufuor Scholars Program.";
  } else if (template === "interview_batch") {
    finalHtml = html ?? `<pre>${escapeHtml(text ?? "")}</pre>`;
    finalText = text ?? "";
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

const SANDBOX_FALLBACK_FROM = "Kufuor Scholars Program <onboarding@resend.dev>";

function isValidEmailFrom(value: string) {
  const s = String(value ?? "").trim();
  if (!s || s.length > 320) return false;
  if (/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s)) return true;
  if (/^[^<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(s)) return true;
  return false;
}

/**
 * EMAIL_FROM is required unless ALLOW_RESEND_SANDBOX_FALLBACK=true (local/dev Edge only).
 * Production Edge must set EMAIL_FROM — never silent onboarding@resend.dev.
 */
function resolveEmailFrom(): { from: string } | { error: "EMAIL_FROM_MISSING" | "EMAIL_FROM_INVALID" } {
  const configured = (Deno.env.get("EMAIL_FROM") ?? "").trim();
  const allowSandbox = (Deno.env.get("ALLOW_RESEND_SANDBOX_FALLBACK") ?? "").trim() === "true";

  if (configured) {
    if (!isValidEmailFrom(configured)) {
      return { error: "EMAIL_FROM_INVALID" };
    }
    const addr = configured.includes("<")
      ? (configured.match(/<([^>]+)>/)?.[1] ?? "").trim().toLowerCase()
      : configured.toLowerCase();
    if (addr === "onboarding@resend.dev" && !allowSandbox) {
      return { error: "EMAIL_FROM_INVALID" };
    }
    return { from: configured };
  }

  if (allowSandbox) {
    return { from: SANDBOX_FALLBACK_FROM };
  }

  return { error: "EMAIL_FROM_MISSING" };
}
