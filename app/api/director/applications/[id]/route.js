import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";

export async function GET(_request, { params }) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    let { data, error } = await admin
      .from("applications")
      .select("*, profiles!applications_user_id_fkey(full_name, email, class_name, role)")
      .eq("id", id)
      .single();

    if (error) {
      const { data: appRow, error: appErr } = await admin
        .from("applications")
        .select("*")
        .eq("id", id)
        .single();

      if (appErr || !appRow) {
        return NextResponse.json(
          { error: "Application not found" },
          { status: appErr?.code === "PGRST116" ? 404 : 500 }
        );
      }

      const { data: prof } = await admin
        .from("profiles")
        .select("full_name, email, class_name, role")
        .eq("id", appRow.user_id)
        .single();

      return NextResponse.json({ application: { ...appRow, profiles: prof || null } });
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ application: data });
  } catch {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
}
