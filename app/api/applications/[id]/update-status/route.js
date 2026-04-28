import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendTransactionalEmail, rejectionEmailHtml, acceptanceEmailHtml } from "@/lib/email/notify";

export async function POST(request, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: directorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (directorProfile?.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, director_notes, class_name, rejection_reason } = body;

  const validStatuses = [
    "pending",
    "shortlisted_for_stage2",
    "stage2_submitted",
    "interview",
    "accepted",
    "rejected",
  ];

  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Update the application status
  const updatePayload = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (director_notes !== undefined) {
    updatePayload.director_notes = director_notes;
  }
  if (status === "rejected" && rejection_reason !== undefined) {
    updatePayload.rejection_reason = rejection_reason || null;
  }
  if (status === "accepted" || status === "shortlisted_for_stage2") {
    updatePayload.rejection_reason = null;
  }

  const { error: appError } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", id);

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 500 });
  }

  const { data: appRow } = await supabase
    .from("applications")
    .select("full_name, user_id")
    .eq("id", id)
    .single();

  let applicantEmail = null;
  let profName = null;
  if (appRow?.user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", appRow.user_id)
      .single();
    applicantEmail = prof?.email ?? null;
    profName = prof?.full_name ?? null;
  }
  const nm = appRow?.full_name || profName || "Applicant";

  if (status === "rejected" && applicantEmail) {
    await sendTransactionalEmail({
      to: applicantEmail,
      subject: "Kufuor Scholars Program — application update",
      html: rejectionEmailHtml(nm, rejection_reason),
      text: `Your application update. ${rejection_reason || ""}`,
    });
  }
  if (status === "accepted" && applicantEmail) {
    await sendTransactionalEmail({
      to: applicantEmail,
      subject: "Congratulations — Kufuor Scholars Program",
      html: acceptanceEmailHtml(nm),
      text: `Congratulations ${nm}, your application has been accepted.`,
    });
  }

  // On acceptance: promote applicant to scholar and assign class
  if (status === "accepted") {
    if (!class_name) {
      return NextResponse.json(
        { error: "class_name is required when accepting an applicant" },
        { status: 400 }
      );
    }

    const { data: application } = await supabase
      .from("applications")
      .select("user_id")
      .eq("id", id)
      .single();

    if (application) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: "scholar", class_name })
        .eq("id", application.user_id);

      if (profileError) {
        return NextResponse.json(
          { error: `Application accepted but failed to update profile: ${profileError.message}` },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
