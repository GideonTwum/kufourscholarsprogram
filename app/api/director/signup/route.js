import { NextResponse } from "next/server";

/**
 * Public director self-signup is disabled for launch.
 * Directors are created by the developer via scripts/create-staff-user.mjs
 * or an existing director admin tool.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Public director signup is disabled. Contact the foundation technical team.",
      code: "SIGNUP_DISABLED",
    },
    { status: 403 }
  );
}
