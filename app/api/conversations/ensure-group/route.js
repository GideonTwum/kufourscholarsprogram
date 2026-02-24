import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("class_name, role")
    .eq("id", user.id)
    .single();

  if (!profile?.class_name) {
    return NextResponse.json({ error: "No class assigned" }, { status: 400 });
  }

  const className = profile.class_name;

  // Check if a group conversation already exists for this class
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .eq("class_name", className)
    .single();

  let conversationId;

  if (existing) {
    conversationId = existing.id;
  } else {
    // Create the group conversation
    const { data: newConvo } = await supabase
      .from("conversations")
      .insert({
        type: "group",
        name: `${className} Chat`,
        class_name: className,
      })
      .select("id")
      .single();

    if (!newConvo) {
      return NextResponse.json(
        { error: "Failed to create group" },
        { status: 500 }
      );
    }
    conversationId = newConvo.id;
  }

  // Ensure the current user is a member
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    await supabase.from("conversation_members").insert({
      conversation_id: conversationId,
      user_id: user.id,
    });
  }

  // Also add all other scholars in the same class who aren't members yet
  const { data: classmates } = await supabase
    .from("profiles")
    .select("id")
    .eq("class_name", className)
    .in("role", ["scholar", "director"]);

  if (classmates) {
    const { data: currentMembers } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);

    const memberIds = new Set(
      (currentMembers || []).map((m) => m.user_id)
    );

    const newMembers = classmates
      .filter((c) => !memberIds.has(c.id))
      .map((c) => ({
        conversation_id: conversationId,
        user_id: c.id,
      }));

    if (newMembers.length > 0) {
      await supabase.from("conversation_members").insert(newMembers);
    }
  }

  return NextResponse.json({ conversationId });
}
