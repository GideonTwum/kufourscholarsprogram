import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function requireDirector() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "director") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request) {
  const gate = await requireDirector();
  if (gate.error) return gate.error;

  const body = await request.json();
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      role: "assessor",
      full_name: fullName || email.split("@")[0],
    },
  });

  if (error) {
    const msg = error.message || "Failed to send invite";
    const status = /already/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const invitedId = data?.user?.id;
  if (invitedId) {
    await admin.from("profiles").upsert(
      {
        id: invitedId,
        email,
        full_name: fullName || email.split("@")[0],
        role: "assessor",
      },
      { onConflict: "id" },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Assessor invite sent. They will receive an email to set their password.",
  });
}
