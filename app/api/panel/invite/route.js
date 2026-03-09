import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, full_name } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
    data: {
      role: "panel",
      full_name: (full_name || "").trim() || email.split("@")[0],
    },
  });

  if (error) {
    if (error.message?.includes("already been registered") || error.code === "user_already_exists") {
      return NextResponse.json(
        { error: "A user with this email already exists. They can log in at the main login page." },
        { status: 400 }
      );
    }
    if (error.message?.includes("already been invited")) {
      return NextResponse.json(
        { error: "An invite was already sent to this email. The recipient should check their inbox (and spam)." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to send invite" },
      { status: 500 }
    );
  }

  const invitedId = data?.user?.id;
  if (invitedId) {
    await admin.from("profiles").upsert(
      {
        id: invitedId,
        email: email.trim(),
        full_name: (full_name || "").trim() || email.split("@")[0],
        role: "panel",
      },
      { onConflict: "id" }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Invite sent. The recipient will receive an email to set their password.",
  });
}
