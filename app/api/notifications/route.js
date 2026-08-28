import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const NOTIFICATIONS_ERROR = "Unable to update notifications. Please try again.";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, message, type, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[notifications] list failed", error.message);
    return NextResponse.json(
      { error: "Unable to load notifications. Please try again." },
      { status: 500 }
    );
  }

  const unread = (data || []).filter((n) => !n.is_read).length;
  return NextResponse.json({ notifications: data || [], unread });
}

export async function PATCH(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { markAllRead, id } = body || {};

  if (markAllRead) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) {
      console.error("[notifications] markAllRead failed", error.message);
      return NextResponse.json({ error: NOTIFICATIONS_ERROR }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (id) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) {
      console.error("[notifications] markOneRead failed", error.message);
      return NextResponse.json({ error: NOTIFICATIONS_ERROR }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Missing id or markAllRead" }, { status: 400 });
}
