import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  INTERVIEW_INVITEES_TABLE,
  hashInviteeAccessToken,
  inviteeAccessTokenIsValid,
  tokensMatch,
} from "@/lib/director-interview-invitees";
import { validateApplicantInterviewResponse } from "@/lib/interview-applicant-response";
import { INTERVIEW_SLOTS_TABLE } from "@/lib/director-interview-batches";

const TOKEN_SELECT =
  "id, full_name, university, email, interview_slot_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, response_status, response_reason, access_token_hash, access_token_expires_at";

async function loadInviteeByToken(token) {
  const hash = hashInviteeAccessToken(token);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: NextResponse.json({ error: "Server misconfiguration" }, { status: 500 }) };
  }
  const { data, error } = await admin
    .from(INTERVIEW_INVITEES_TABLE)
    .select(TOKEN_SELECT)
    .eq("access_token_hash", hash)
    .maybeSingle();
  if (error || !data) {
    return { error: NextResponse.json({ error: "Invitation link is invalid or has expired." }, { status: 404 }) };
  }
  if (!tokensMatch(data.access_token_hash, token) || !inviteeAccessTokenIsValid(data)) {
    return { error: NextResponse.json({ error: "Invitation link is invalid or has expired." }, { status: 404 }) };
  }
  if (!data.published_at && !data.invitation_sent_at) {
    return { error: NextResponse.json({ error: "This invitation has not been published yet." }, { status: 403 }) };
  }
  const { data: slot } = data.interview_slot_id
    ? await admin
        .from(INTERVIEW_SLOTS_TABLE)
        .select("id, batch_name, interview_date, interview_time, end_time, location, meeting_link, status")
        .eq("id", data.interview_slot_id)
        .maybeSingle()
    : { data: null };
  return { admin, invitee: data, slot };
}

function publicPayload(invitee, slot) {
  return {
    full_name: invitee.full_name,
    university: invitee.university,
    source_label: "University Invitee",
    interview: slot
      ? {
          date: slot.interview_date,
          start_time: slot.interview_time,
          end_time: slot.end_time,
          venue: slot.location,
          format: invitee.interview_format,
          meeting_link: invitee.meeting_link || slot.meeting_link || null,
        }
      : null,
    response_status: invitee.response_status || "awaiting_response",
  };
}

export async function GET(_request, { params }) {
  const token = String((await params)?.token || "").trim();
  if (!token) return NextResponse.json({ error: "Missing invitation link." }, { status: 400 });
  const loaded = await loadInviteeByToken(token);
  if (loaded.error) return loaded.error;
  return NextResponse.json(publicPayload(loaded.invitee, loaded.slot));
}

export async function POST(request, { params }) {
  const token = String((await params)?.token || "").trim();
  if (!token) return NextResponse.json({ error: "Missing invitation link." }, { status: 400 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const loaded = await loadInviteeByToken(token);
  if (loaded.error) return loaded.error;
  const checked = validateApplicantInterviewResponse({ action: body.action, reason: body.reason });
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error === "reason_required" ? "Please explain your request." : "Invalid response." }, { status: 400 });
  }
  const { error } = await loaded.admin
    .from(INTERVIEW_INVITEES_TABLE)
    .update({
      response_status: checked.response_status,
      response_reason: checked.reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loaded.invitee.id);
  if (error) return NextResponse.json({ error: "Could not save response" }, { status: 500 });
  return NextResponse.json({
    success: true,
    response_status: checked.response_status,
    appointment_unchanged: true,
  });
}
