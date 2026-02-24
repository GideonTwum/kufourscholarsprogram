import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = ["/applicant", "/director"];
const authRoutes = ["/login", "/register", "/director-signup"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const { supabase, user, supabaseResponse } = await updateSession(request);

  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));
  const isProtected = !isAuthRoute && protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    if (pathname.startsWith("/director")) {
      if (role !== "director") {
        const url = request.nextUrl.clone();
        url.pathname = "/applicant";
        return NextResponse.redirect(url);
      }
    } else if (pathname.startsWith("/applicant")) {
      if (role === "director") {
        const url = request.nextUrl.clone();
        url.pathname = "/director";
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

    if (role === "director") {
      url.pathname = "/director";
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
