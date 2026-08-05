import { NextResponse } from "next/server";
import { getEmailConfig } from "@/lib/email/config";
import { sendKspEmail } from "@/lib/email/send";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const to = gate.user.email;
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
    directorId: gate.user.id,
  });

  await recordDirectorAudit({
    actor: gate.profile,
    action: "email.test",
    entityType: "email",
    entityId: null,
    newValue: { ok: result.ok, via: result.via || null },
    request,
    critical: false,
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
      sandboxSenderInUse: cfg.sandboxSenderInUse,
      emailFromDomain: cfg.emailFromDomainClass,
      fromError: cfg.fromError,
      missing: cfg.missing,
    },
  });
}

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const cfg = getEmailConfig();
  return NextResponse.json({
    configuration: {
      hasResendApiKey: Boolean(cfg.resendApiKey),
      hasEmailFrom: Boolean(cfg.configuredFrom),
      hasSiteUrl: Boolean(cfg.siteUrl),
      hasServiceRoleKey: Boolean(cfg.serviceRoleKey),
      isProductionReady: cfg.isProductionReady,
      usingDevFallbackFrom: cfg.usingDevFallbackFrom,
      sandboxSenderInUse: cfg.sandboxSenderInUse,
      emailFromDomain: cfg.emailFromDomainClass,
      fromError: cfg.fromError,
      missing: cfg.missing,
    },
  });
}
