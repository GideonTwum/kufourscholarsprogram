import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";

/**
 * Deprecated: use POST /api/director/panel/create (temporary password shown once).
 */
export async function POST() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  return NextResponse.json(
    {
      error:
        "Panel invite-by-email is deprecated. Create panel credentials at /director/panel (POST /api/director/panel/create).",
      code: "GONE",
    },
    { status: 410 }
  );
}
