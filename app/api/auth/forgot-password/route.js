import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/auth-rate-limit";
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  isValidEmailFormat,
  normalizeRecoveryPortal,
  passwordResetCallbackUrl,
} from "@/lib/auth-recovery";

function hashEmail(email) {
  // Lightweight non-cryptographic bucket key — avoid logging raw emails.
  let h = 0;
  const s = email.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `e${h.toString(16)}`;
}

/**
 * Always returns a generic success body (except rate-limit).
 * Does not disclose whether the email exists.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  normalizeRecoveryPortal(body?.portal);

  if (!isValidEmailFormat(email)) {
    // Same message — do not reveal validation failure details beyond format on client.
    return NextResponse.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limit = consumeRateLimit(`forgot:${hashEmail(email)}:${ip}`, {
    windowMs: 60_000,
    max: 3,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterSec: limit.retryAfterSec,
        message: FORGOT_PASSWORD_SUCCESS_MESSAGE,
      },
      { status: 429 }
    );
  }

  try {
    const supabase = await createClient();
    const redirectTo = passwordResetCallbackUrl(
      process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    );
    // Intentionally ignore error details — always respond generically.
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // swallow
  }

  return NextResponse.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
}
