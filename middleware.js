import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = ["/applicant", "/director", "/panel"];
const authRoutes = [
  "/login",
  "/director-login",
  "/register",
  "/applicant-register",
];

function applicantNeedsEmailVerification(user) {
  if (!user?.email) return false;
  return user.email_confirmed_at == null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const { supabase, user, supabaseResponse } = await updateSession(request);

  const isDirectorSignup =
    pathname === "/director/signup" || pathname.startsWith("/director/signup/");
  if (user && isDirectorSignup) {
    const { data: signupProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (signupProfile?.role === "director") {
      const url = request.nextUrl.clone();
      url.pathname = "/director";
      return NextResponse.redirect(url);
    }
  }

  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));
  const verifyEmailPath =
    pathname === "/applicant/verify-email" || pathname.startsWith("/applicant/verify-email/");

  const isProtected =
    !isAuthRoute && !isDirectorSignup && protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.startsWith("/director")
        ? "/director-login"
        : "/login";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (
      pathname.startsWith("/applicant") &&
      !verifyEmailPath &&
      (role === "applicant" || !role) &&
      applicantNeedsEmailVerification(user)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/applicant/verify-email";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/director")) {
      if (role !== "director") {
        const url = request.nextUrl.clone();
        url.pathname = role === "panel" ? "/panel" : "/applicant";
        return NextResponse.redirect(url);
      }
    } else if (pathname.startsWith("/panel")) {
      if (role !== "panel") {
        const url = request.nextUrl.clone();
        url.pathname = role === "director" ? "/director" : "/applicant";
        return NextResponse.redirect(url);
      }
    } else if (pathname.startsWith("/applicant")) {
      if (role === "director") {
        const url = request.nextUrl.clone();
        url.pathname = "/director";
        return NextResponse.redirect(url);
      }
      if (role === "panel") {
        const url = request.nextUrl.clone();
        url.pathname = "/panel";
        return NextResponse.redirect(url);
      }
      if (role !== "applicant" && !pathname.startsWith("/applicant")) {
        const url = request.nextUrl.clone();
        url.pathname = "/applicant";
        return NextResponse.redirect(url);
      }
    }
  }

  if (isAuthRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "applicant";
    const url = request.nextUrl.clone();

    if (pathname.startsWith("/director-login")) {
      if (role === "director") {
        url.pathname = "/director";
      } else if (role === "panel") {
        url.pathname = "/panel";
      } else {
        url.pathname = "/applicant";
      }
      return NextResponse.redirect(url);
    }

    if (pathname === "/login" || pathname.startsWith("/login/")) {
      if (role === "director") {
        url.pathname = "/director";
      } else if (role === "panel") {
        url.pathname = "/panel";
      } else {
        url.pathname = "/applicant";
      }
      return NextResponse.redirect(url);
    }

    if (role === "director") {
      url.pathname = "/director";
    } else if (role === "panel") {
      url.pathname = "/panel";
    } else {
      url.pathname = "/applicant";
    }

    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
