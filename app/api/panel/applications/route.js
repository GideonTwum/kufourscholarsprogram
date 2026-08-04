import { PANEL_INTERVIEW_STATUSES } from "@/lib/panel-applications";
import { requireActivePanelUser, getAdminOrError } from "@/lib/director-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireActivePanelUser();
  if (gate.error) return gate.error;

  try {
    const adminGate = await getAdminOrError();
    if (adminGate.error) return adminGate.error;
    const admin = adminGate.admin;

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
