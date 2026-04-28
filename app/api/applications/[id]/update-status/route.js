import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendTransactionalEmail, rejectionEmailHtml, acceptanceEmailHtml } from "@/lib/email/notify";
import { sendPlatformEmail } from "@/lib/send-email-runtime";

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function interviewInviteHtml(k) {
  return `
<p>Dear ${esc(k.name)},</p>
<p>You have been <strong>called for an interview</strong> with the Kufuor Scholars Program.</p>
<ul>
<li><strong>Date:</strong> ${esc(k.interviewDate)}</li>
<li><strong>Time:</strong> ${esc(k.interviewTime)}</li>
<li><strong>Location / link:</strong> ${esc(k.interviewLocation)}</li>
</ul>
${k.interviewInstructions ? `<p><strong>Instructions:</strong><br/>${esc(k.interviewInstructions)}</p>` : ""}
<p>Best,<br/>The Kufuor Scholars Program Team</p>`;
}

const VALID = [
  "stage_1_approved",
  "stage_2_approved",
  "called_for_interview",
  "accepted",
  "rejected",
];

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
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status, director_notes, class_name, rejection_reason, interview } = body;

  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const updatePayload = {
    status,
    updated_at: nowIso,
  };

  if (director_notes !== undefined) {
    updatePayload.director_notes = director_notes;
  }

  if (status === "rejected" && rejection_reason !== undefined) {
    updatePayload.rejection_reason = rejection_reason || null;
  }

  if (["accepted", "stage_1_approved", "stage_2_approved"].includes(status)) {
    updatePayload.rejection_reason = null;
  }

  if (status === "stage_1_approved") {
    updatePayload.stage_1_approved_at = nowIso;
  }
  if (status === "stage_2_approved") {
    updatePayload.stage_2_approved_at = nowIso;
  }

  if (status === "called_for_interview") {
    const d = interview?.interview_date;
    const loc = interview?.interview_location?.trim?.() ?? "";
    const tim = interview?.interview_time?.trim?.() ?? "";
    const instr = interview?.interview_instructions?.trim?.() ?? "";
    if (!d || !loc || !tim) {
      return NextResponse.json(
        { error: "Interview date, time, and location (or meeting link) are required." },
        { status: 400 }
      );
    }
    updatePayload.interview_date = d;
    updatePayload.interview_time = tim;
    updatePayload.interview_location = loc;
    updatePayload.interview_instructions = instr || null;
  }

  const { error: appError } = await supabase.from("applications").update(updatePayload).eq("id", id);

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 500 });
  }

  const { data: appRow } = await supabase
    .from("applications")
    .select("full_name, user_id, interview_date, interview_time, interview_location, interview_instructions")
    .eq("id", id)
    .single();

  let applicantEmail = null;
  let applicantUserId = appRow?.user_id;
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

  async function notifyPlatform(title, message, type = "info") {
    if (!applicantUserId) return;
    await supabase.from("notifications").insert({
      user_id: applicantUserId,
      title,
      message,
      type,
    });
  }

  if (status === "stage_1_approved" && applicantUserId) {
    await notifyPlatform(
      "Stage 1 approved",
      "Congratulations — your Stage 1 application has been approved. You may now proceed to Stage 2.",
      "success"
    );
    if (applicantEmail) {
      await sendPlatformEmail({
        to: applicantEmail,
        subject: "Kufuor Scholars — Stage 1 approved",
        html: `<p>Dear ${esc(nm)},</p><p>Congratulations, your Stage 1 application has been approved. You may now proceed to the next stage.</p><p>Best,<br/>The Kufuor Scholars Program Team</p>`,
        text: `Congratulations — your Stage 1 application has been approved. You may proceed to the next stage.`,
        template: "stage1_approved",
        meta: { applicantName: nm },
      });
    }
  }

  if (status === "stage_2_approved" && applicantUserId) {
    await notifyPlatform(
      "Stage 2 approved",
      "Congratulations — your Stage 2 application has been approved. Please await interview scheduling.",
      "success"
    );
    if (applicantEmail) {
      await sendPlatformEmail({
        to: applicantEmail,
        subject: "Kufuor Scholars — Stage 2 approved",
        html: `<p>Dear ${esc(nm)},</p><p>Congratulations, your Stage 2 application has been approved. Please check your dashboard for the next step.</p><p>Best,<br/>The Kufuor Scholars Program Team</p>`,
        text: `Congratulations — your Stage 2 application has been approved. Check your dashboard for next steps.`,
        template: "stage2_approved",
        meta: { applicantName: nm },
      });
    }
  }

  if (status === "called_for_interview" && applicantUserId) {
    await notifyPlatform(
      "Interview invitation",
      `You have been called for an interview on ${appRow.interview_date} at ${appRow.interview_time}. Check your email for details.`,
      "info"
    );
    if (applicantEmail) {
      await sendPlatformEmail({
        to: applicantEmail,
        subject: "Kufuor Scholars — Interview invitation",
        html: interviewInviteHtml({
          name: nm,
          interviewDate: String(appRow.interview_date ?? ""),
          interviewTime: String(appRow.interview_time ?? ""),
          interviewLocation: String(appRow.interview_location ?? ""),
          interviewInstructions: String(appRow.interview_instructions ?? ""),
        }),
        text: `Interview: ${String(appRow.interview_date ?? "")} at ${String(appRow.interview_time ?? "")}. ${String(appRow.interview_location ?? "")}.`,
        template: "interview_invite",
        meta: {
          applicantName: nm,
          interviewDate: String(appRow.interview_date ?? ""),
          interviewTime: String(appRow.interview_time ?? ""),
          interviewLocation: String(appRow.interview_location ?? ""),
          interviewInstructions: String(appRow.interview_instructions ?? ""),
        },
      });
    }
  }

  if (status === "rejected" && applicantEmail) {
    await notifyPlatform("Application update", "Your application status has been updated.", "warning");
    await sendTransactionalEmail({
      to: applicantEmail,
      subject: "Kufuor Scholars Program — application update",
      html: rejectionEmailHtml(nm, rejection_reason),
      text: `Your application update. ${rejection_reason || ""}`,
    });
  }

  if (status === "accepted" && applicantEmail) {
    await notifyPlatform("Accepted to the program", "Congratulations — you have been accepted to the Kufuor Scholars Program.", "success");
    await sendTransactionalEmail({
      to: applicantEmail,
      subject: "Congratulations — Kufuor Scholars Program",
      html: acceptanceEmailHtml(nm),
      text: `Congratulations ${nm}, your application has been accepted.`,
    });
  }

  if (status === "accepted") {
    if (!class_name) {
      return NextResponse.json({ error: "class_name is required when accepting an applicant" }, { status: 400 });
    }

    const { data: application } = await supabase.from("applications").select("user_id").eq("id", id).single();

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
