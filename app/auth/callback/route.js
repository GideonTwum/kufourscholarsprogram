import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthRedirectPath } from "@/lib/application-status-transition.mjs";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeAuthRedirectPath(requestUrl.searchParams.get("next"), "/applicant");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
