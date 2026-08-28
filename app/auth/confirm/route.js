import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  logEmailVerificationEvent,
  normalizeEmailConfirmOtpType,
  verificationErrorLoginPath,
  verifiedLoginPath,
} from "@/lib/auth-email-confirm";

/**
 * Token-hash email confirmation (PKCE-independent).
 *
 * Email template must link here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *
 * After confirm: clear session → /login?verified=true (explicit password sign-in).
 */
export async function GET(request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const token_hash = requestUrl.searchParams.get("token_hash");
  const rawType = requestUrl.searchParams.get("type");
  const type = normalizeEmailConfirmOtpType(rawType);

  if (!token_hash || typeof token_hash !== "string" || !token_hash.trim()) {
    logEmailVerificationEvent("verify_rejected", {
      method: "token_hash",
      type: rawType,
      code: "missing_token_hash",
      message: "Missing token_hash",
    });
    return NextResponse.redirect(new URL(verificationErrorLoginPath(origin)));
  }

  if (!type) {
    logEmailVerificationEvent("verify_rejected", {
      method: "token_hash",
      type: rawType,
      code: "unsupported_type",
      message: "Unsupported confirmation type",
    });
    return NextResponse.redirect(new URL(verificationErrorLoginPath(origin)));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token_hash.trim(),
    type,
  });

  if (error) {
    logEmailVerificationEvent("verify_failed", {
      method: "token_hash",
      type,
      code: error.code || null,
      message: error.message || null,
    });
    return NextResponse.redirect(new URL(verificationErrorLoginPath(origin)));
  }

  logEmailVerificationEvent("verify_ok", {
    method: "token_hash",
    type,
    code: null,
    message: null,
  });

  // Verification proves email ownership only — require explicit password login.
  try {
    await supabase.auth.signOut();
  } catch (signOutErr) {
    console.error("[auth/confirm]", {
      event: "sign_out_after_verify_failed",
      method: "token_hash",
      message: signOutErr?.message ? String(signOutErr.message).slice(0, 200) : "sign_out_error",
      ts: new Date().toISOString(),
    });
  }

  return NextResponse.redirect(new URL(verifiedLoginPath(origin)));
}
