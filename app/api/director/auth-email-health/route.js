import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { buildAuthEmailHealth } from "@/lib/auth-email-health";

/**
 * GET /api/director/auth-email-health
 * Active Director + AAL2 only. Never returns secret values.
 */
export async function GET(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const host = request.headers.get("host");
  return NextResponse.json(buildAuthEmailHealth({ requestHost: host }));
}
