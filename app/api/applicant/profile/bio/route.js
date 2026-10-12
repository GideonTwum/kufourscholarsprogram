import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isApplicantRole } from "@/lib/portal-auth";

const BIO_LIMIT = 4000;

function ownAvatarUrl(userId, value) {
  if (typeof value !== "string" || !value.trim()) return false;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const expected = `/storage/v1/object/public/avatars/${userId}/`;
  return url.pathname.includes(expected);
}

export async function PATCH(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isApplicantRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const unknown = Object.keys(body || {}).filter((key) => key !== "bio" && key !== "photo_url");
  if (unknown.length > 0) {
    return NextResponse.json({ error: "Unknown fields are not allowed." }, { status: 400 });
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, "bio")) {
    if (typeof body.bio !== "string") {
      return NextResponse.json({ error: "Bio must be text." }, { status: 400 });
    }
    const bio = body.bio.trim();
    if (bio.length > BIO_LIMIT) {
      return NextResponse.json({ error: "Bio is too long." }, { status: 400 });
    }
    patch.bio = bio;
  }
  if (Object.prototype.hasOwnProperty.call(body, "photo_url")) {
    if (body.photo_url === "" || body.photo_url == null) {
      patch.photo_url = null;
    } else if (!ownAvatarUrl(user.id, body.photo_url)) {
      return NextResponse.json({ error: "Profile photo must be uploaded to your avatar folder." }, { status: 400 });
    } else {
      patch.photo_url = body.photo_url.trim();
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes to save." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  return NextResponse.json({ success: true });
}
