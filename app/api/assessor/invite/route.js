import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";

/**
 * Deprecated: use POST /api/director/assessors/create (temporary password shown once).
 */
export async function POST() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  return NextResponse.json(
    {
      error:
        "Assessor invite-by-email is deprecated. Create assessor credentials at /director/assessors (POST /api/director/assessors/create).",
      code: "GONE",
    },
    { status: 410 }
  );
}
