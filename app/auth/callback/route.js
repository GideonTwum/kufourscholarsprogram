import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirectPath } from "@/lib/application-status-transition.mjs";
import { isApplicantRole, resolvePostAuthRedirect } from "@/lib/portal-auth";

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

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = safeAuthRedirectPath(
    requestUrl.searchParams.get("next"),
    "/applicant"
  );

  const supabase = await createClient();
  let exchanged = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
    exchanged = true;
  }

  // Password recovery must keep the recovery session on /reset-password.
  if (
    requestedNext === "/reset-password" ||
    requestedNext.startsWith("/reset-password/")
  ) {
    return NextResponse.redirect(new URL(requestedNext, requestUrl.origin));
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
    return NextResponse.redirect(
      new URL("/login?verified=true", requestUrl.origin)
    );
  }

  const destination = resolvePostAuthRedirect(role, requestedNext);
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
