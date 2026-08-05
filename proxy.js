import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";
import { dashboardPathForRole, isDirectorRole } from "@/lib/roles";
import { loginPathForProtectedRoute } from "@/lib/portal-auth";
import {
  isDirectorMfaPath,
  MFA_CHALLENGE_PATH,
  MFA_SETUP_PATH,
  resolveDirectorMfaDestination,
} from "@/lib/director-mfa";

const protectedRoutes = ["/applicant", "/director", "/panel", "/assessor"];
const authRoutes = [
  "/login",
  "/director-login",
  "/assessor-login",
  "/panel-login",
  "/register",
  "/applicant-register",
  "/forgot-password",
];

/** Recovery session must stay on this page — do not bounce to dashboard. */
function isRecoveryRoute(pathname) {
  return pathname === "/reset-password" || pathname.startsWith("/reset-password/");
}

function applicantNeedsEmailVerification(user) {
  if (!user?.email) return false;
  return user.email_confirmed_at == null;
}

async function fetchProfile(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[proxy] profile fetch failed:", {
      code: error.code || null,
      message: error.message || null,
      details: error.details || null,
      hint: error.hint || null,
    });
    return null;
  }
  return profile;
}

async function enforceDirectorMfa(request, supabase, profile) {
  const { pathname } = request.nextUrl;
  if (!isDirectorRole(profile?.role)) return null;
  if (profile?.is_active === false) return null;

  const dest = await resolveDirectorMfaDestination(supabase);
  const onMfa = isDirectorMfaPath(pathname);

  if (dest === "setup") {
    if (pathname === MFA_SETUP_PATH || pathname.startsWith(`${MFA_SETUP_PATH}/`)) {
      return null;
    }
    const url = request.nextUrl.clone();
    url.pathname = MFA_SETUP_PATH;
    return NextResponse.redirect(url);
  }

  if (dest === "challenge") {
    if (pathname === MFA_CHALLENGE_PATH || pathname.startsWith(`${MFA_CHALLENGE_PATH}/`)) {
      return null;
    }
    const url = request.nextUrl.clone();
    url.pathname = MFA_CHALLENGE_PATH;
    return NextResponse.redirect(url);
  }

  if (dest === "ok" && onMfa) {
    const url = request.nextUrl.clone();
    url.pathname = "/director";
    return NextResponse.redirect(url);
  }

  if (dest === "error" && !onMfa) {
    const url = request.nextUrl.clone();
    url.pathname = MFA_CHALLENGE_PATH;
    return NextResponse.redirect(url);
  }

  return null;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const isDirectorSignup =
    pathname === "/director/signup" || pathname.startsWith("/director/signup/");
  if (isDirectorSignup) {
    const url = request.nextUrl.clone();
    url.pathname = "/director-login";
    return NextResponse.redirect(url);
  }

  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));
  const verifyEmailPath =
    pathname === "/applicant/verify-email" || pathname.startsWith("/applicant/verify-email/");
  const isProtected =
    !isAuthRoute &&
    !isRecoveryRoute(pathname) &&
    protectedRoutes.some((r) => pathname.startsWith(r));

  let supabase;
  let user;
  let supabaseResponse;
  try {
    ({ supabase, user, supabaseResponse } = await updateSession(request));
  } catch (err) {
    console.error("[middleware] session update failed:", err?.message ?? err);
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = loginPathForProtectedRoute(pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  if (isProtected) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = loginPathForProtectedRoute(pathname);
      return NextResponse.redirect(url);
    }

    const profile = await fetchProfile(supabase, user.id);
    const role = typeof profile?.role === "string" ? profile.role : undefined;
    if (!role) {
      const url = request.nextUrl.clone();
      url.pathname = loginPathForProtectedRoute(pathname);
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/panel") && role === "panel" && profile?.is_active === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/panel-login";
      url.searchParams.set("deactivated", "1");
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/assessor") && role === "assessor" && profile?.is_active === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/assessor-login";
      url.searchParams.set("deactivated", "1");
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/director") && isDirectorRole(role) && profile?.is_active === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/director-login";
      url.searchParams.set("deactivated", "1");
      return NextResponse.redirect(url);
    }

    if (
      pathname.startsWith("/applicant") &&
      !verifyEmailPath &&
      (role === "applicant" || role === "scholar") &&
      applicantNeedsEmailVerification(user)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/applicant/verify-email";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/director")) {
      if (!isDirectorRole(role)) {
        const url = request.nextUrl.clone();
        url.pathname = dashboardPathForRole(role);
        return NextResponse.redirect(url);
      }
      const mfaRedirect = await enforceDirectorMfa(request, supabase, profile);
      if (mfaRedirect) return mfaRedirect;
    } else if (pathname.startsWith("/panel")) {
      if (role !== "panel") {
        const url = request.nextUrl.clone();
        url.pathname = dashboardPathForRole(role);
        return NextResponse.redirect(url);
      }
    } else if (pathname.startsWith("/assessor")) {
      if (role !== "assessor") {
        const url = request.nextUrl.clone();
        url.pathname = dashboardPathForRole(role);
        return NextResponse.redirect(url);
      }
    } else if (pathname.startsWith("/applicant")) {
      if (isDirectorRole(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/director";
        return NextResponse.redirect(url);
      }
      if (role === "panel") {
        const url = request.nextUrl.clone();
        url.pathname = "/panel";
        return NextResponse.redirect(url);
      }
      if (role === "assessor") {
        const url = request.nextUrl.clone();
        url.pathname = "/assessor";
        return NextResponse.redirect(url);
      }
    }
  }

  if (isAuthRoute && user) {
    const profile = await fetchProfile(supabase, user.id);
    const role = typeof profile?.role === "string" ? profile.role : undefined;
    if (!role) {
      return supabaseResponse;
    }
    if (
      (role === "panel" || role === "assessor" || isDirectorRole(role)) &&
      profile?.is_active === false &&
      (pathname.startsWith("/panel-login") ||
        pathname.startsWith("/assessor-login") ||
        pathname.startsWith("/director-login") ||
        pathname.startsWith("/login"))
    ) {
      return supabaseResponse;
    }
    // Allow browsing forgot-password while signed in (e.g. change of mind).
    if (pathname.startsWith("/forgot-password")) {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = dashboardPathForRole(role);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
