import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BUCKET = "applications";
const EXPIRE_SECONDS = 3600; // 1 hour

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

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

  const isDirector = profile?.role === "director";
  const isOwner = path.startsWith(`${user.id}/`);

  if (!isDirector && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, EXPIRE_SECONDS);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data?.signedUrl });
}
