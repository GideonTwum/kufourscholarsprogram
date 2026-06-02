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

export async function GET() {
  const gate = await requirePanel();
  if (gate.error) return gate.error;

  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("applications")
      .select("*, profiles!applications_user_id_fkey(full_name, email)")
      .in("status", PANEL_INTERVIEW_STATUSES)
      .order("submitted_at", { ascending: false });

    if (!error) {
      return NextResponse.json({ applications: data || [] });
    }

    console.error("[panel/applications] embed query failed:", error.message);

    const { data: fallback, error: fallbackError } = await admin
      .from("applications")
      .select("*")
      .in("status", PANEL_INTERVIEW_STATUSES)
      .order("submitted_at", { ascending: false });

    if (fallbackError) {
      console.error("[panel/applications] fallback query failed:", fallbackError.message);
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }

    return NextResponse.json({ applications: fallback || [] });
  } catch (e) {
    console.error("[panel/applications] server error:", e.message);
    return NextResponse.json(
      { error: e.message || "Server configuration error" },
      { status: 500 }
    );
  }
}
