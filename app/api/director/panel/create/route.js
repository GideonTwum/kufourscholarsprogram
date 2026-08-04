import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { createStaffUserWithAdmin } from "@/lib/staff-credentials";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

/**
 * Create panel member credentials (email + temporary password).
 * Password is returned once — never stored in the database.
 */
export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const result = await createStaffUserWithAdmin(admin, {
    role: "panel",
    email: body?.email,
    full_name: body?.full_name,
    password: body?.temporary_password,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "panel.created",
    entityType: "profile",
    entityId: result.userId,
    newValue: { email: result.email, role: "panel" },
    request,
  });

  return NextResponse.json({
    success: true,
    email: result.email,
    role: "panel",
    user_id: result.userId,
    temporary_password: result.temporaryPassword,
    login_url: "/panel-login",
    message:
      "Panel account created. Copy the temporary password now — it will not be shown again. Share it securely. Panel member signs in at /panel-login.",
  });
}
