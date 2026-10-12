import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncVerifiedApplicantEmail } from "@/lib/applicant-email-sync";
import {
  emailChangedLoginPath,
  isEmailChangeOtpType,
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
  const emailChange = isEmailChangeOtpType(rawType);
  const type = emailChange ? "email_change" : normalizeEmailConfirmOtpType(rawType);

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
  const { data, error } = await supabase.auth.verifyOtp({
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

  try {
    const user = data?.user || (await supabase.auth.getUser()).data.user;
    if (user?.id) {
      await syncVerifiedApplicantEmail(createAdminClient(), user);
    }
  } catch (syncErr) {
    console.error("[auth/confirm]", {
      event: "profile_email_sync_failed",
      message: syncErr?.message ? String(syncErr.message).slice(0, 200) : "sync_error",
      ts: new Date().toISOString(),
    });
  }

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

  return NextResponse.redirect(
    new URL(emailChange ? emailChangedLoginPath(origin) : verifiedLoginPath(origin))
  );
}
