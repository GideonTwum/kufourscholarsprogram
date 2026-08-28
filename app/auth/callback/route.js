import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirectPath } from "@/lib/application-status-transition.mjs";
import { isApplicantRole, resolvePostAuthRedirect } from "@/lib/portal-auth";
import {
  logEmailVerificationEvent,
  normalizeEmailConfirmOtpType,
  verificationErrorLoginPath,
  verifiedLoginPath,
} from "@/lib/auth-email-confirm";

/**
 * Applicant email confirmation must not leave an authenticated session that
 * would bounce /login → /applicant. Verification proves email ownership only;
 * password sign-in remains an explicit second step.
 */
function isApplicantEmailVerificationNext(requestedNext, role) {
  if (requestedNext === "/login" || requestedNext.startsWith("/login/")) {
    return true;
  }
  // Legacy confirmation links used next=/applicant — still force explicit sign-in.
  if (
    (isApplicantRole(role) || !role) &&
    (requestedNext === "/applicant" || requestedNext.startsWith("/applicant/"))
  ) {
    return true;
  }
  return false;
}

/**
 * Legacy / OAuth / recovery callback.
 * Prefer /auth/confirm + token_hash for applicant signup confirmation (cross-browser).
 * Still accepts token_hash here for older email templates that point at /auth/callback.
 * PKCE ?code= exchange remains for password recovery and other flows.
 */
export async function GET(request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const rawType = requestUrl.searchParams.get("type");
  const requestedNext = safeAuthRedirectPath(
    requestUrl.searchParams.get("next"),
    "/applicant"
  );

  const supabase = await createClient();
  let exchanged = false;

  // Cross-browser email confirmation via token_hash (no PKCE verifier required).
  if (token_hash && typeof token_hash === "string" && token_hash.trim()) {
    const type = normalizeEmailConfirmOtpType(rawType) || "email";
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token_hash.trim(),
      type,
    });
    if (error) {
      logEmailVerificationEvent("verify_failed", {
        method: "token_hash_via_callback",
        type,
        code: error.code || null,
        message: error.message || null,
      });
      return NextResponse.redirect(new URL(verificationErrorLoginPath(origin)));
    }
    logEmailVerificationEvent("verify_ok", {
      method: "token_hash_via_callback",
      type,
    });
    try {
      await supabase.auth.signOut();
    } catch {
      /* non-fatal */
    }
    return NextResponse.redirect(new URL(verifiedLoginPath(origin)));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logEmailVerificationEvent("verify_failed", {
        method: "pkce_code",
        type: null,
        code: error.code || null,
        message: error.message || null,
      });
      return NextResponse.redirect(new URL(verificationErrorLoginPath(origin)));
    }
    exchanged = true;
  }

  // Password recovery must keep the recovery session on /reset-password.
  if (
    requestedNext === "/reset-password" ||
    requestedNext.startsWith("/reset-password/")
  ) {
    return NextResponse.redirect(new URL(requestedNext, origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = typeof profile?.role === "string" ? profile.role : null;
  }

  if (exchanged && isApplicantEmailVerificationNext(requestedNext, role)) {
    // Clear the session Supabase creates during email confirmation.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(verifiedLoginPath(origin)));
  }

  const destination = resolvePostAuthRedirect(role, requestedNext);
  return NextResponse.redirect(new URL(destination, origin));
}
