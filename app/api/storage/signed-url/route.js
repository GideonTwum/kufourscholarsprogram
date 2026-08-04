import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isDirectorRole } from "@/lib/roles";
import { sanitizeStoragePath, isOwnerStoragePath } from "@/lib/storage-path";

const BUCKET = "applications";
const EXPIRE_SECONDS = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path");

  const sanitized = sanitizeStoragePath(rawPath);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }
  const path = sanitized.path;

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
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const isDirector = isDirectorRole(profile?.role) && profile?.is_active !== false;
  const isPanel = profile?.role === "panel" && profile?.is_active !== false;
  const isAssessor = profile?.role === "assessor" && profile?.is_active !== false;
  const isOwner = isOwnerStoragePath(path, user.id);
  const ownerUserId = path.split("/")[0];

  const allowed =
    isDirector ||
    isOwner ||
    (await (async () => {
      if (isPanel) {
        const { data: app } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", ownerUserId)
          .in("status", ["called_for_interview", "interview"])
          .maybeSingle();
        return !!app;
      }

      if (isAssessor) {
        const { data: app } = await supabase
          .from("applications")
          .select("id, assessor_assignments!inner(id)")
          .eq("user_id", ownerUserId)
          .eq("assessor_assignments.assessor_id", user.id)
          .eq("assessor_assignments.status", "active")
          .maybeSingle();
        return !!app;
      }

      return false;
    })());

  if (!allowed) {
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
