import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isApplicantRole } from "@/lib/portal-auth";
import { INTERVIEW_ALLOCATION_TABLE } from "@/lib/director-interview-allocation";
import {
  INTERVIEW_LOCATION_CONFIRMATION_TABLE,
  persistInterviewLocationConfirmation,
  validateInterviewLocationConfirmation,
} from "@/lib/director-interview-location";
import {
  INTERVIEW_REQUEST_STATUSES,
  validateApplicantInterviewResponse,
} from "@/lib/interview-applicant-response";
import { isInterviewSlotPublished } from "@/lib/director-interview-batches";

async function requireApplicant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isApplicantRole(profile.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, profile, supabase };
}

async function loadOwnApplication(admin, userId) {
  const { data } = await admin
    .from("applications")
    .select("id, user_id, status, full_name, region, university, interview_slot_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET() {
  const gate = await requireApplicant();
  if (gate.error) return gate.error;
  const admin = createAdminClient();
  const application = await loadOwnApplication(admin, gate.user.id);
  if (!application) return NextResponse.json({ interview: null });

  const { data: allocation } = await admin
    .from(INTERVIEW_ALLOCATION_TABLE)
    .select(
      "id, interview_slot_id, appointment_id, schedule_day_id, interview_format, meeting_link, meeting_instructions, published_at, invitation_sent_at, response_status"
    )
    .eq("application_id", application.id)
    .maybeSingle();

  const { data: confirmation } = await admin
    .from(INTERVIEW_LOCATION_CONFIRMATION_TABLE)
    .select("confirmed_region, confirmed_town, study_institution, study_region, source")
    .eq("application_id", application.id)
    .maybeSingle();

  const slotId = application.interview_slot_id || null;
  const { data: slot } = slotId
    ? await admin
        .from("interview_slots")
        .select("id, batch_name, interview_date, interview_time, end_time, location, meeting_link, published_at, invitation_sent_at, status")
        .eq("id", slotId)
        .maybeSingle()
    : { data: null };

  const published = Boolean(
    slot &&
      slot.status !== "cancelled" &&
      (isInterviewSlotPublished(slot) ||
        ["called_for_interview", "interview"].includes(application.status))
  );

  if (!published) {
    return NextResponse.json({
      interview: null,
      location_confirmation: confirmation,
      region: application.region || null,
      university: application.university || null,
      can_confirm_location: ["stage_2_approved", "interview_review_pending", "called_for_interview"].includes(
        application.status
      ),
    });
  }

  const { data: schedule } = await admin
    .from("interview_schedules")
    .select(
      "physical_venue, whatsapp_contact, physical_instructions, virtual_instructions, required_documents_physical, required_documents_virtual, policy_wording, reschedule_policy_wording, arrival_minutes"
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: requests } = await admin
    .from("application_interview_requests")
    .select("id, request_type, reason, status, created_at, director_notes")
    .eq("application_id", application.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const format = allocation?.interview_format || "in_person";
  return NextResponse.json({
    interview: {
      format,
      date: slot.interview_date || null,
      start_time: String(slot.interview_time || "").slice(0, 5),
      end_time: String(slot.end_time || "").slice(0, 5),
      venue: format === "virtual" ? null : schedule?.physical_venue || slot.location || null,
      meeting_link: format === "virtual" ? allocation?.meeting_link || slot.meeting_link : null,
      meeting_instructions: format === "virtual" ? allocation?.meeting_instructions : null,
      instructions:
        format === "virtual" ? schedule?.virtual_instructions : schedule?.physical_instructions,
      documents:
        format === "virtual"
          ? schedule?.required_documents_virtual
          : schedule?.required_documents_physical,
      policy: schedule?.policy_wording,
      reschedule_policy: schedule?.reschedule_policy_wording,
      whatsapp_contact: schedule?.whatsapp_contact,
      response_status: allocation?.response_status || null,
      batch_name: slot.batch_name,
    },
    requests: requests || [],
    location_confirmation: confirmation,
    region: application.region || null,
    university: application.university || null,
    can_confirm_location: true,
    can_self_schedule: false,
  });
}

export async function POST(request) {
  const gate = await requireApplicant();
  if (gate.error) return gate.error;
  const admin = createAdminClient();
  const application = await loadOwnApplication(admin, gate.user.id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "confirm_location") {
    const validated = validateInterviewLocationConfirmation({
      confirmedRegion: body.confirmed_region || body.study_region,
      confirmedTown: body.confirmed_town,
      studyInstitution: body.study_institution,
      studyRegion: body.study_region || body.confirmed_region,
      source: "applicant",
    });
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
    const saved = await persistInterviewLocationConfirmation(admin, {
      applicationId: application.id,
      validated,
      actorId: gate.user.id,
    });
    if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
    return NextResponse.json({ success: true, confirmation: saved.confirmation });
  }

  if (!application.interview_slot_id) {
    return NextResponse.json({ error: "Interview invitation is not published yet." }, { status: 403 });
  }

  const { data: allocation } = await admin
    .from(INTERVIEW_ALLOCATION_TABLE)
    .select("id, interview_slot_id, appointment_id, published_at, response_status")
    .eq("application_id", application.id)
    .maybeSingle();

  const validated = validateApplicantInterviewResponse(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  if (allocation?.id) {
    await admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .update({
        response_status: validated.response_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", allocation.id);
  }

  if (validated.kind === "request") {
    const requestRow = {
      application_id: application.id,
      allocation_id: allocation?.id || null,
      request_type: validated.request_type,
      reason: validated.reason,
      status: INTERVIEW_REQUEST_STATUSES.pending,
      current_appointment_id: allocation?.appointment_id || null,
    };
    const withSlot = await admin.from("application_interview_requests").insert({
      ...requestRow,
      current_interview_slot_id: application.interview_slot_id,
    });
    if (withSlot.error) {
      await admin.from("application_interview_requests").insert(requestRow);
    }
  }

  return NextResponse.json({
    success: true,
    response_status: validated.response_status,
    appointment_unchanged: true,
  });
}
