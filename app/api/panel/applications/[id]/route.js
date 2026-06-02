import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { PANEL_INTERVIEW_STATUSES } from "@/lib/panel-applications";

async function requirePanel() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "panel") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(_request, { params }) {
  const gate = await requirePanel();
  if (gate.error) return gate.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    let { data, error } = await admin
      .from("applications")
      .select("*, profiles!applications_user_id_fkey(full_name, email)")
      .eq("id", id)
      .in("status", PANEL_INTERVIEW_STATUSES)
      .single();

    if (error) {
      console.error("[panel/applications/[id]] embed query failed:", error.message);
      const { data: appRow, error: appErr } = await admin
        .from("applications")
        .select("*")
        .eq("id", id)
        .in("status", PANEL_INTERVIEW_STATUSES)
        .single();

      if (appErr || !appRow) {
        const code = appErr?.code === "PGRST116" ? 404 : 500;
        return NextResponse.json(
          { error: appErr?.message || error.message || "Not found" },
          { status: code }
        );
      }

      const { data: prof } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", appRow.user_id)
        .single();

      return NextResponse.json({ application: { ...appRow, profiles: prof || null } });
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ application: data });
  } catch (e) {
    console.error("[panel/applications/[id]] server error:", e.message);
    return NextResponse.json(
      { error: e.message || "Server configuration error" },
      { status: 500 }
    );
  }
}
