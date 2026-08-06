import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirectPath } from "@/lib/application-status-transition.mjs";
import { resolvePostAuthRedirect } from "@/lib/portal-auth";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = safeAuthRedirectPath(
    requestUrl.searchParams.get("next"),
    "/applicant"
  );

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
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

  const destination = resolvePostAuthRedirect(role, requestedNext);
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
