import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { isValidAnnouncementAudience } from "@/lib/announcement-audiences";
import { recordDirectorAudit } from "@/lib/audit/director-audit";

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;

  const { data, error } = await adminGate.admin
    .from("announcements")
    .select("*, profiles:director_id(full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
  return NextResponse.json({ announcements: data || [] });
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

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const audience = body?.audience;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }
  if (!isValidAnnouncementAudience(audience)) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;

  const { data, error } = await adminGate.admin
    .from("announcements")
    .insert({
      title,
      content,
      audience,
      director_id: gate.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "announcement.created",
    entityType: "announcement",
    entityId: data.id,
    newValue: { title, audience },
    request,
  });

  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;

  const { error } = await adminGate.admin.from("announcements").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: "announcement.deleted",
    entityType: "announcement",
    entityId: id,
    request,
  });

  return NextResponse.json({ success: true });
}
