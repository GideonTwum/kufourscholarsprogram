import { NextResponse } from "next/server";
import { requireActiveDirector } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { data, error } = await gate.supabase
    .from("panel_members")
    .select("id, full_name, email, phone, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load panel members" }, { status: 500 });
  }
  return NextResponse.json({ panel_members: data || [] });
}

export async function POST(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { full_name, email, phone, role } = body;
  if (!full_name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "full_name and email are required." }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("panel_members")
    .insert({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      role: role?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create panel member" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "panel_roster.created",
    entityType: "panel_member",
    entityId: data.id,
    newValue: { email: email.trim().toLowerCase(), full_name: full_name.trim() },
    request,
  });

  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing } = await gate.supabase
    .from("panel_members")
    .select("id, email, full_name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await gate.supabase.from("panel_members").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to delete panel member" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "panel_roster.deleted",
    entityType: "panel_member",
    entityId: id,
    oldValue: existing || null,
    request,
  });

  return NextResponse.json({ success: true });
}
