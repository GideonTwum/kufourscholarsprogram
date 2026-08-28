import { NextResponse } from "next/server";

/**
 * Best-effort signup failure diagnostics for production incidents.
 * Never accepts passwords/tokens. Logs only safe metadata.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const stage = String(body?.stage || "UNKNOWN").slice(0, 64);
  const code = body?.code != null ? String(body.code).slice(0, 80) : null;
  const status = Number(body?.status || 0) || null;
  const message = body?.message != null ? String(body.message).slice(0, 200) : null;
  const emailDomain =
    body?.emailDomain != null
      ? String(body.emailDomain)
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, "")
          .slice(0, 80)
      : null;

  console.error("[signup-diagnostic]", {
    event: "SIGNUP_FAILED",
    stage,
    code,
    status,
    message,
    emailDomain,
    ts: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
