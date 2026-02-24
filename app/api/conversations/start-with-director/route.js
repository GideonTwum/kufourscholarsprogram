import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "director") {
    return NextResponse.json(
      { error: "Directors use the director portal to message applicants" },
      { status: 400 }
    );
  }

  const { data: directors } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "director")
    .limit(1);

  if (!directors?.length) {
    return NextResponse.json(
      { error: "No directors available to contact" },
      { status: 404 }
    );
  }

  const directorId = directors[0].id;

  const { data: existing } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id);

  if (existing?.length) {
    const convoIds = existing.map((r) => r.conversation_id);
    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .in("id", convoIds)
      .eq("type", "direct");

    for (const convo of convos || []) {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", convo.id);
      const hasDirector = members?.some((m) => m.user_id === directorId);
      const hasApplicant = members?.some((m) => m.user_id === user.id);
      if (hasDirector && hasApplicant) {
        return NextResponse.json({ conversationId: convo.id });
      }
    }
  }

  const { data: newConvo, error: insertErr } = await supabase
    .from("conversations")
    .insert({ type: "direct" })
    .select("id")
    .single();

  if (insertErr || !newConvo) {
    return NextResponse.json(
      { error: insertErr?.message || "Failed to create conversation" },
      { status: 500 }
    );
  }

  const { error: memberErr } = await supabase.from("conversation_members").insert([
    { conversation_id: newConvo.id, user_id: user.id },
    { conversation_id: newConvo.id, user_id: directorId },
  ]);

  if (memberErr) {
    await supabase.from("conversations").delete().eq("id", newConvo.id);
    return NextResponse.json(
      { error: memberErr.message || "Failed to add participants" },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversationId: newConvo.id });
}
