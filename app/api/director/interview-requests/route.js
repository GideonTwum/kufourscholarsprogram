import { NextResponse } from "next/server";
import { requireActiveDirector, getAdminOrError } from "@/lib/director-auth";
import { recordDirectorAudit } from "@/lib/audit/director-audit";
import { sendKspEmail } from "@/lib/email/send";
import { INTERVIEW_ALLOCATION_TABLE } from "@/lib/director-interview-allocation";
import { INTERVIEW_REQUEST_STATUSES } from "@/lib/interview-applicant-response";
import { INTERVIEW_FORMATS } from "@/lib/director-interview-appointments";
import { fetchInterviewLocationConfirmationsMap } from "@/lib/director-interview-location";
import { STUDY_LOCATION_UNCONFIRMED_LABEL, studyRegionLabel, studyTownDisplay, studyInstitutionDisplay, hasLocationConfirmation } from "@/lib/director-location-filter";
import { APPLICATION_CLASS_SETTING_KEY, DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";
import { ensureInterviewSchedule } from "@/lib/director-interview-schedule";
import { buildRescheduleNotificationEmail } from "@/lib/director-interview-invitations";
import { NOTIFICATION_DELIVERY_STATUSES } from "@/lib/director-interview-capacity";
import {
  INTERVIEW_REQUESTS_TABLE,
  classifyInterviewRequestQueryError,
  fetchDirectorInterviewRequests,
} from "@/lib/director-interview-requests";
import { fetchInterviewInvitees, UNIVERSITY_INVITEE_LABEL } from "@/lib/director-interview-invitees";
import { INTERVIEW_SLOTS_TABLE } from "@/lib/director-interview-batches";

export async function GET() {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;

  try {
    const loaded = await fetchDirectorInterviewRequests(adminGate.admin);
    if (loaded.error) {
      const kind = loaded.kind || classifyInterviewRequestQueryError(loaded.error);
      const message = loaded.error.message || String(loaded.error);
      if (kind === "missing_table") {
        return NextResponse.json(
          {
            error: message,
            code: "INTERVIEW_REQUESTS_TABLE_MISSING",
            hint: `Expected public.${INTERVIEW_REQUESTS_TABLE}. Apply supabase-migration-interview-timetable.sql only if that table is absent.`,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: message, code: "INTERVIEW_REQUESTS_QUERY_FAILED", kind },
        { status: 500 }
      );
    }
    const data = loaded.data;
    const slotIds = [
      ...new Set(
        (data || [])
          .flatMap((row) => [
            row.current_interview_slot_id,
            row.replacement_interview_slot_id,
            row.applications?.interview_slot_id,
          ])
          .filter(Boolean)
      ),
    ];
    const appointmentById = {};
    if (slotIds.length) {
      const { data: slots } = await adminGate.admin
        .from("interview_slots")
        .select("id, interview_date, interview_time, end_time, batch_name")
        .in("id", slotIds);
      for (const slot of slots || []) {
        appointmentById[slot.id] = {
          id: slot.id,
          date: slot.interview_date || null,
          start_time: String(slot.interview_time || "").slice(0, 5),
          end_time: String(slot.end_time || "").slice(0, 5),
          batch_name: slot.batch_name,
        };
      }
    }
    const applicationIds = [...new Set((data || []).map((row) => row.application_id).filter(Boolean))];
    const confirmationsById = await fetchInterviewLocationConfirmationsMap(adminGate.admin, applicationIds);
    const confirmations = confirmationsById.__error ? {} : confirmationsById;
    const applicantRequests = (data || []).map((row) => {
        const wrapped = { location_confirmation: confirmations[row.application_id] || null };
        const confirmed = hasLocationConfirmation(wrapped);
        return {
          ...row,
          source_kind: "applicant",
          reviewable: true,
          full_name: row.applications?.full_name || "Unknown",
          current_appointment:
            appointmentById[row.current_interview_slot_id] ||
            appointmentById[row.applications?.interview_slot_id] ||
            null,
          replacement_appointment: appointmentById[row.replacement_interview_slot_id] || null,
          study_location_confirmed: confirmed,
          study_region: confirmed ? studyRegionLabel(wrapped) : STUDY_LOCATION_UNCONFIRMED_LABEL,
          study_town: confirmed ? studyTownDisplay(wrapped) : STUDY_LOCATION_UNCONFIRMED_LABEL,
          study_institution: confirmed ? studyInstitutionDisplay(wrapped) : STUDY_LOCATION_UNCONFIRMED_LABEL,
          notification_status: row.notification_status || null,
          previous_interview_date: row.previous_interview_date || null,
          previous_interview_time: row.previous_interview_time || null,
          new_interview_date: row.new_interview_date || null,
          new_interview_time: row.new_interview_time || null,
        };
      });
    const { data: inviteeSlots } = await adminGate.admin
      .from(INTERVIEW_SLOTS_TABLE)
      .select("id, batch_name, interview_date, interview_time, end_time, published_at, invitation_sent_at, status");
    const inviteeSlotsById = Object.fromEntries((inviteeSlots || []).map((slot) => [slot.id, slot]));
    const loadedInvitees = await fetchInterviewInvitees(adminGate.admin, { slotsById: inviteeSlotsById });
    const inviteeRequests = (loadedInvitees.invitees || [])
      .filter((row) =>
        ["virtual_requested", "reschedule_requested", "unable_to_attend", "attendance_confirmed"].includes(
          row.response_status
        )
      )
      .map((row) => ({
        id: `invitee:${row.id}`,
        source_kind: "invitee",
        source_label: UNIVERSITY_INVITEE_LABEL,
        reviewable: false,
        full_name: row.full_name,
        request_type:
          row.response_status === "attendance_confirmed"
            ? "attendance_confirmed"
            : row.response_status === "virtual_requested"
              ? "virtual"
              : row.response_status === "unable_to_attend"
                ? "unable_to_attend"
                : "reschedule",
        status: row.response_status === "attendance_confirmed" ? "confirmed" : "pending",
        reason: row.response_reason || "",
        current_appointment: row.assigned_slot_id
          ? {
              id: row.assigned_slot_id,
              date: row.assigned_batch_date,
              start_time: String(row.assigned_batch_time || "").split("–")[0] || null,
              end_time: String(row.assigned_batch_time || "").split("–")[1] || null,
              batch_name: row.assigned_batch_name,
            }
          : null,
        study_region: row.university,
        study_town: row.nationality || "—",
        study_institution: row.university,
        created_at: row.updated_at || row.created_at || null,
      }));
    return NextResponse.json({
      requests: [...inviteeRequests, ...applicantRequests],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load interview requests",
        code: "INTERVIEW_REQUESTS_LOAD_FAILED",
      },
      { status: 500 }
    );
  }
}

async function deliverRescheduleNotification(admin, { requestRow, result, applicantName, email, userId, directorId }) {
  const { data: classSetting } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", APPLICATION_CLASS_SETTING_KEY)
    .maybeSingle();
  const className =
    (typeof classSetting?.value === "string" && classSetting.value.trim()) ||
    DEFAULT_APPLICATION_CLASS_NAME;
  const { schedule } = await ensureInterviewSchedule(admin, className);
  const emailBody = buildRescheduleNotificationEmail({
    applicantName,
    previous: result.previous || {
      date: requestRow.previous_interview_date,
      time: requestRow.previous_interview_time,
    },
    next: result.next || {
      date: requestRow.new_interview_date,
      time: requestRow.new_interview_time,
    },
    schedule: schedule || {},
  });
  let sendResult = { ok: false, sent: false, reason: "missing_email" };
  if (email) {
    sendResult = await sendKspEmail({
      event: emailBody.event,
      to: email,
      subject: emailBody.subject,
      html: emailBody.html,
      text: emailBody.text,
      template: emailBody.template,
      meta: { applicationId: requestRow.application_id, requestId: requestRow.id },
      directorId,
    });
  }
  const status = sendResult.ok && sendResult.sent
    ? NOTIFICATION_DELIVERY_STATUSES.sent
    : NOTIFICATION_DELIVERY_STATUSES.failed;
  const patch = {
    notification_status: status,
    notification_sent_at: status === NOTIFICATION_DELIVERY_STATUSES.sent ? new Date().toISOString() : null,
    notification_last_error: status === NOTIFICATION_DELIVERY_STATUSES.failed ? sendResult.reason || "send_failed" : null,
    updated_at: new Date().toISOString(),
  };
  const saved = await admin.from(INTERVIEW_REQUESTS_TABLE).update(patch).eq("id", requestRow.id);
  if (saved.error) {
    /* columns may be pending 004; assignment already recorded on the request row */
  }
  if (status === NOTIFICATION_DELIVERY_STATUSES.sent && userId) {
    await admin.from("notifications").insert({
      user_id: userId,
      title: "Interview rescheduled",
      message: emailBody.text,
      type: "interview_slot",
    });
  }
  return { ...patch, notified: status === NOTIFICATION_DELIVERY_STATUSES.sent };
}

export async function PATCH(request) {
  const gate = await requireActiveDirector();
  if (gate.error) return gate.error;
  const adminGate = await getAdminOrError();
  if (adminGate.error) return adminGate.error;
  const admin = adminGate.admin;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: current } = await admin
    .from(INTERVIEW_REQUESTS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (body.action === "retry_notification") {
    if (current.status !== INTERVIEW_REQUEST_STATUSES.approved || current.request_type !== "reschedule") {
      return NextResponse.json({ error: "nothing_to_retry" }, { status: 409 });
    }
    if (current.notification_status === NOTIFICATION_DELIVERY_STATUSES.sent) {
      return NextResponse.json({ success: true, notified: 0, skipped_duplicate: 1, notify_applicants: true });
    }
    const { data: app } = await admin
      .from("applications")
      .select("id, full_name, user_id, profiles!applications_user_id_fkey(email, full_name)")
      .eq("id", current.application_id)
      .maybeSingle();
    const delivery = await deliverRescheduleNotification(admin, {
      requestRow: current,
      result: {
        previous: { date: current.previous_interview_date, time: current.previous_interview_time },
        next: { date: current.new_interview_date, time: current.new_interview_time, location: null },
      },
      applicantName: app?.profiles?.full_name || app?.full_name,
      email: app?.profiles?.email,
      userId: app?.user_id,
      directorId: gate.profile?.id,
    });
    return NextResponse.json({
      success: delivery.notified,
      notified: delivery.notified ? 1 : 0,
      failed_count: delivery.notified ? 0 : 1,
      notify_applicants: true,
    });
  }

  const decision = body.status;
  if (!["approved", "declined"].includes(decision)) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }
  if (current.status !== INTERVIEW_REQUEST_STATUSES.pending) {
    return NextResponse.json({ error: "Request already decided" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const patch = {
    status: decision,
    decided_by: gate.profile?.id,
    decided_at: nowIso,
    director_notes: typeof body.director_notes === "string" ? body.director_notes.trim() : current.director_notes,
    updated_at: nowIso,
  };

  if (decision === "approved" && current.request_type === "virtual") {
    const meetingLink = typeof body.meeting_link === "string" ? body.meeting_link.trim() : "";
    if (!meetingLink) {
      return NextResponse.json({ error: "meeting_link required to approve a virtual interview" }, { status: 400 });
    }
    await admin
      .from(INTERVIEW_ALLOCATION_TABLE)
      .update({
        interview_format: INTERVIEW_FORMATS.virtual,
        meeting_link: meetingLink,
        meeting_instructions:
          typeof body.meeting_instructions === "string" ? body.meeting_instructions.trim() || null : null,
        response_status: "awaiting_response",
        updated_at: nowIso,
      })
      .eq("application_id", current.application_id);
  }

  let rescheduleResult = null;
  if (decision === "approved" && current.request_type === "reschedule") {
    const replacementId =
      (typeof body.replacement_interview_slot_id === "string" && body.replacement_interview_slot_id) ||
      (typeof body.replacement_appointment_id === "string" && body.replacement_appointment_id) ||
      "";
    if (!replacementId) {
      return NextResponse.json({ error: "replacement_interview_slot_id required" }, { status: 400 });
    }
    const { data, error } = await admin.rpc("reschedule_interview_batch_assignment", {
      p_request_id: id,
      p_replacement_slot_id: replacementId,
      p_actor_id: gate.profile?.id || null,
      p_director_notes: patch.director_notes,
    });
    if (error) {
      const message = String(error.message || "");
      if (/does not exist|42883/i.test(message)) {
        return NextResponse.json(
          { error: "BATCH_LOCK_UNAVAILABLE", detail: "Apply supabase-migration-interview-batch-hardening.sql." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: message || "reschedule_failed" }, { status: 409 });
    }
    if (data?.ok === false) {
      return NextResponse.json({ error: data.error, available: data.available }, { status: 409 });
    }
    rescheduleResult = data;
    patch.replacement_interview_slot_id = replacementId;
    patch.notification_status = NOTIFICATION_DELIVERY_STATUSES.pending;
  }

  if (decision === "declined") {
    const declinedPatch = {
      response_status: "awaiting_response",
      updated_at: nowIso,
    };
    if (current.request_type === "virtual") {
      declinedPatch.interview_format = INTERVIEW_FORMATS.in_person;
    }
    await admin.from(INTERVIEW_ALLOCATION_TABLE).update(declinedPatch).eq("application_id", current.application_id);
  }

  if (!rescheduleResult) {
    const saved = await admin.from(INTERVIEW_REQUESTS_TABLE).update(patch).eq("id", id);
    if (saved.error && patch.replacement_interview_slot_id) {
      const fallbackPatch = { ...patch };
      delete fallbackPatch.replacement_interview_slot_id;
      delete fallbackPatch.notification_status;
      await admin.from(INTERVIEW_REQUESTS_TABLE).update(fallbackPatch).eq("id", id);
    }
  }

  let delivery = { notified: false };
  if (rescheduleResult) {
    const { data: app } = await admin
      .from("applications")
      .select("id, full_name, user_id, profiles!applications_user_id_fkey(email, full_name)")
      .eq("id", current.application_id)
      .maybeSingle();
    delivery = await deliverRescheduleNotification(admin, {
      requestRow: { ...current, id },
      result: rescheduleResult,
      applicantName: app?.profiles?.full_name || app?.full_name,
      email: app?.profiles?.email,
      userId: app?.user_id,
      directorId: gate.profile?.id,
    });
  }

  await recordDirectorAudit({
    actor: gate.profile,
    action: `interview_request.${decision}`,
    entityType: INTERVIEW_REQUESTS_TABLE,
    entityId: id,
    newValue: {
      ...patch,
      previous: rescheduleResult?.previous || null,
      next: rescheduleResult?.next || null,
      notification_status: delivery.notification_status || patch.notification_status || null,
    },
    request,
  });
  return NextResponse.json({
    success: true,
    notify_applicants: Boolean(rescheduleResult),
    notified: delivery.notified ? 1 : 0,
    failed_count: rescheduleResult && !delivery.notified ? 1 : 0,
    previous: rescheduleResult?.previous || null,
    next: rescheduleResult?.next || null,
  });
}
