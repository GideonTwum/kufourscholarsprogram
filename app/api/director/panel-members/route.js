import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function requireDirector(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "director") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const supabase = await createClient();
  const gate = await requireDirector(supabase);
  if (gate.error) return gate.error;

  const { data, error } = await supabase
    .from("panel_members")
    .select("id, full_name, email, phone, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ panel_members: data || [] });
}

export async function POST(request) {
  const supabase = await createClient();
  const gate = await requireDirector(supabase);
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

  const { data, error } = await supabase
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(request) {
  const supabase = await createClient();
  const gate = await requireDirector(supabase);
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await supabase.from("panel_members").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
