import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { validateStage2Video } from "@/lib/application-validation";
import { assertStatusTransition } from "@/lib/application-status-transition.mjs";
import { sendKspEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role && profile.role !== "applicant" && profile.role !== "scholar") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const applicationId = body?.application_id;
  const videoUrl = typeof body?.video_youtube_url === "string" ? body.video_youtube_url.trim() : "";
  const confirms = {
    confirms_youtube_public: Boolean(body?.confirms_youtube_public),
    confirms_youtube_title_format: Boolean(body?.confirms_youtube_title_format),
    confirms_youtube_description_concept: Boolean(body?.confirms_youtube_description_concept),
  };

  if (!applicationId || typeof applicationId !== "string") {
    return NextResponse.json({ error: "application_id is required" }, { status: 400 });
  }

  const fieldErrors = validateStage2Video({ video_youtube_url: videoUrl, ...confirms });
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: Object.values(fieldErrors)[0] || "Invalid video submission" },
      { status: 400 }
    );
  }

  let db;
  try {
    db = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const { data: app, error: loadError } = await db
    .from("applications")
    .select("id, user_id, status, full_name")
    .eq("id", applicationId)
    .single();

  if (loadError || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (app.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const transitionError = assertStatusTransition(app.status, "stage_2_submitted");
  if (transitionError) {
    return NextResponse.json({ error: transitionError }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await db
    .from("applications")
    .update({
      video_youtube_url: videoUrl,
      status: "stage_2_submitted",
      stage_2_submitted_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const name = app.full_name || profile?.full_name || "Applicant";
  const to = profile?.email || user.email;
  if (to) {
    await sendKspEmail({
      event: "stage_2_submitted",
      to,
      subject: "Kufuor Scholars — Stage 2 video received",
      html: `<p>Dear ${escapeHtml(name)},</p>
<p>Your Stage 2 video submission has been received and is pending review.</p>
<p>Best,<br/>The Kufuor Scholars Program Team</p>`,
      text: "Your Stage 2 video submission has been received and is pending review.",
      template: "stage2_submitted",
      meta: { applicantName: name },
    });
  }

  return NextResponse.json({ success: true, status: "stage_2_submitted" });
}
