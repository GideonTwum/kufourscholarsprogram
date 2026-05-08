import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email/notify";

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request) {
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
    .maybeSingle();

  if (directorProfile?.role !== "director") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    batch_name,
    interview_date,
    interview_time,
    location,
    congratulations_message,
    application_ids = [],
  } = body;

  if (!batch_name || !interview_date || !interview_time || !location) {
    return NextResponse.json(
      { error: "batch_name, interview_date, interview_time, and location are required" },
      { status: 400 }
    );
  }

  const { data: slot, error: slotError } = await supabase
    .from("interview_slots")
    .insert({
      director_id: user.id,
      batch_name,
      interview_date,
      interview_time,
      location,
      congratulations_message: congratulations_message || null,
    })
    .select("id")
    .single();

  if (slotError) {
    return NextResponse.json({ error: slotError.message }, { status: 500 });
  }

  if (!application_ids?.length) {
    return NextResponse.json({ success: true, slot_id: slot.id });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("applications")
    .update({
      interview_slot_id: slot.id,
      status: "called_for_interview",
      updated_at: nowIso,
    })
    .in("id", application_ids)
    .in("status", ["called_for_interview", "interview"]);

  if (updateError) {
    return NextResponse.json(
      { error: `Slot created but assignment failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  const { data: rows } = await supabase
    .from("applications")
    .select("id, user_id, full_name, profiles(email)")
    .in("id", application_ids)
    .eq("interview_slot_id", slot.id);

  const formattedDate =
    typeof interview_date === "string"
      ? new Date(interview_date + "T12:00:00").toLocaleDateString("en-GB", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : String(interview_date);

  for (const row of rows || []) {
    const name = row.full_name || "Applicant";
    const email =
      Array.isArray(row.profiles)
        ? row.profiles[0]?.email
        : row.profiles?.email;

    const messageText = [
      `Dear ${name},`,
      ``,
      `You have been assigned to interview batch "${batch_name}".`,
      `Date: ${formattedDate}`,
      `Time: ${interview_time}`,
      `Location: ${location}`,
      congratulations_message ? `\nDetails:\n${congratulations_message}` : "",
      ``,
      `Please sign in to the Kufuor Scholars applicant portal to view details on your dashboard.`,
    ]
      .filter(Boolean)
      .join("\n");

    await supabase.from("notifications").insert({
      user_id: row.user_id,
      title: "Interview batch scheduled",
      message: `${batch_name} — ${formattedDate} at ${interview_time}. Location: ${location}`,
      type: "interview_slot",
    });

    if (email) {
      await sendTransactionalEmail({
        to: email,
        subject: `Kufuor Scholars Program — Interview: ${batch_name}`,
        html: `
          <p>Dear ${escHtml(name)},</p>
          <p>You have been assigned to interview batch <strong>${escHtml(batch_name)}</strong>.</p>
          <ul>
            <li><strong>Date:</strong> ${escHtml(formattedDate)}</li>
            <li><strong>Time:</strong> ${escHtml(interview_time)}</li>
            <li><strong>Location:</strong> ${escHtml(location)}</li>
          </ul>
          ${
            congratulations_message
              ? `<p>${escHtml(congratulations_message).replace(/\n/g, "<br/>")}</p>`
              : ""
          }
          <p>Please sign in to the applicant dashboard for any updates.</p>
          <p>Best,<br/>The Kufuor Scholars Program Team</p>
        `,
        text: messageText,
      });
    }
  }

  return NextResponse.json({ success: true, slot_id: slot.id, notified: (rows || []).length });
}
