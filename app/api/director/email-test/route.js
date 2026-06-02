import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getEmailConfig } from "@/lib/email/config";
import { sendKspEmail } from "@/lib/email/send";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "director") {
    return NextResponse.json({ error: "Forbidden — directors only" }, { status: 403 });
  }

  const to = user.email;
  if (!to) {
    return NextResponse.json({ error: "Your account has no email address." }, { status: 400 });
  }

  const cfg = getEmailConfig();

  const result = await sendKspEmail({
    event: "email_test",
    to,
    subject: "Kufuor Scholars — test email",
    template: "email_test",
    html: `
      <p>This is a test email from the Kufuor Scholars Program platform.</p>
      <p>If you received this, Resend and EMAIL_FROM are configured correctly.</p>
      <p><small>Sent at ${new Date().toISOString()}</small></p>
    `,
    text: "This is a test email from the Kufuor Scholars Program platform.",
    directorId: user.id,
  });

  return NextResponse.json({
    success: result.ok,
    sent: result.sent,
    via: result.via,
    reason: result.reason || null,
    configuration: {
      hasResendApiKey: Boolean(cfg.resendApiKey),
      hasEmailFrom: Boolean(cfg.configuredFrom),
      hasSiteUrl: Boolean(cfg.siteUrl),
      hasServiceRoleKey: Boolean(cfg.serviceRoleKey),
      isProductionReady: cfg.isProductionReady,
      usingDevFallbackFrom: cfg.usingDevFallbackFrom,
      missing: cfg.missing,
    },
  });
}

export async function GET() {
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

  const cfg = getEmailConfig();
  return NextResponse.json({
    configuration: {
      hasResendApiKey: Boolean(cfg.resendApiKey),
      hasEmailFrom: Boolean(cfg.configuredFrom),
      hasSiteUrl: Boolean(cfg.siteUrl),
      hasServiceRoleKey: Boolean(cfg.serviceRoleKey),
      isProductionReady: cfg.isProductionReady,
      usingDevFallbackFrom: cfg.usingDevFallbackFrom,
      missing: cfg.missing,
    },
  });
}
