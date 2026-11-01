/**
 * Invitation copy for published interview_slots batches.
 * Individual appointment publication is disabled.
 */

import { escapeHtml, escapeHtmlWithBreaks } from "./email/escape.js";
import { INTERVIEW_FORMATS, formatAppointmentLabel } from "./director-interview-appointments.js";
import { isInvitationAlreadySent } from "./director-interview-capacity.js";

export const DEFAULT_INTERVIEW_POLICY =
  "This final stage of the recruitment process will be conducted in person. However, provision has been made for applicants currently studying in northern Ghana to request a virtual interview, subject to approval by the recruitment team.";

export const DEFAULT_RESCHEDULE_POLICY =
  "If you have a legitimate reason why your assigned interview date or time would be unsuitable, please respond immediately to this email explaining your circumstances. You must also send a WhatsApp message to the official recruitment contact, stating your name, assigned interview date and time, and reason for requesting a change. Please note that approval of rescheduling requests is at the discretion of the recruitment team and subject to the availability of interview appointments.";

export function isAllocationPublished(allocation, application = null) {
  return Boolean(
    allocation?.published_at ||
      allocation?.invitation_sent_at ||
      (application?.interview_slot_id && application?.status === "called_for_interview")
  );
}

export function publicationBlockers(row, schedule = {}, slot = null) {
  const issues = [];
  const batch = slot || row?.slot || null;
  if (!batch?.id) issues.push("missing_batch");
  const format = row?.allocation?.interview_format || INTERVIEW_FORMATS.in_person;
  if (format === INTERVIEW_FORMATS.virtual) {
    if (!String(row.allocation?.meeting_link || batch?.meeting_link || "").trim()) {
      issues.push("missing_meeting_link");
    }
  } else if (!String(schedule.physical_venue || batch?.location || "").trim()) {
    issues.push("missing_venue");
  }
  if (!row?.email) issues.push("missing_email");
  if (isInvitationAlreadySent(row)) issues.push("already_published");
  return issues;
}

export function previewInterviewInvitations({ rows = [], schedule = {}, slot = null } = {}) {
  const ready = [];
  const blocked = [];
  const already = [];
  for (const row of rows) {
    const issues = publicationBlockers(row, schedule, slot);
    if (issues.includes("already_published")) {
      already.push({ id: row.id, issues });
      continue;
    }
    if (issues.length) blocked.push({ id: row.id, name: row.full_name, issues });
    else ready.push(row);
  }
  return {
    ready,
    ready_count: ready.length,
    blocked_count: blocked.length,
    already_published: already.length,
    blocked,
    already,
    notify_applicants: true,
    missing_venue: !String(schedule.physical_venue || slot?.location || "").trim(),
    missing_whatsapp: !String(schedule.whatsapp_contact || "").trim(),
    dates: [...new Set(ready.map((row) => slot?.interview_date || row.slot?.interview_date).filter(Boolean))],
  };
}

export function buildInterviewInvitationEmail({ applicantName, appointment, allocation, schedule, slot }) {
  const name = applicantName || "Applicant";
  const format = allocation?.interview_format === INTERVIEW_FORMATS.virtual ? "Virtual" : "In person";
  const batch = slot || appointment || {};
  const when = formatAppointmentLabel(
    batch.interview_date,
    batch.interview_time || batch.start_time,
    batch.end_time
  );
  const venue =
    allocation?.interview_format === INTERVIEW_FORMATS.virtual
      ? "A meeting link is included below. Do not share it."
      : schedule.physical_venue || batch.location || "Venue will be confirmed by the recruitment team.";
  const arrival =
    allocation?.interview_format === INTERVIEW_FORMATS.virtual
      ? schedule.virtual_instructions ||
        "Please be ready and connected at least 15 minutes before your scheduled interview time."
      : schedule.physical_instructions ||
        "Please arrive at least 15 minutes before your assigned batch begins.";
  const documents =
    allocation?.interview_format === INTERVIEW_FORMATS.virtual
      ? schedule.required_documents_virtual ||
        "Have a digital copy of your CV and WASSCE and/or NovDec examination results available."
      : schedule.required_documents_physical ||
        "Please bring three printed copies of your CV and your WASSCE and/or NovDec examination results, as applicable.";
  const policy = schedule.policy_wording || DEFAULT_INTERVIEW_POLICY;
  const reschedule = schedule.reschedule_policy_wording || DEFAULT_RESCHEDULE_POLICY;
  const whatsapp = schedule.whatsapp_contact
    ? `Official WhatsApp contact: ${schedule.whatsapp_contact}`
    : "The official WhatsApp contact will be provided by the recruitment team.";
  const meetingLink = allocation?.meeting_link || (format === "Virtual" ? batch.meeting_link : null);
  const meeting =
    format === "Virtual" && meetingLink
      ? `<p><strong>Meeting link:</strong> ${escapeHtml(meetingLink)}</p>
         <p>${escapeHtmlWithBreaks(allocation?.meeting_instructions || "")}</p>`
      : "";

  const html = `
    <p>Dear ${escapeHtml(name)},</p>
    <p>You are invited to a Kufuor Scholars Program interview.</p>
    <ul>
      <li><strong>Date and batch time:</strong> ${escapeHtml(when)}</li>
      <li><strong>Format:</strong> ${escapeHtml(format)}</li>
      <li><strong>Location / access:</strong> ${escapeHtml(venue)}</li>
    </ul>
    ${meeting}
    ${
      slot?.congratulations_message
        ? `<p>${escapeHtmlWithBreaks(slot.congratulations_message)}</p>`
        : ""
    }
    <p>${escapeHtmlWithBreaks(arrival)}</p>
    <p>${escapeHtmlWithBreaks(documents)}</p>
    <p>${escapeHtmlWithBreaks(policy)}</p>
    <p>Please sign in to the applicant portal to confirm attendance or submit a request. You cannot change your assigned batch yourself.</p>
    <p>${escapeHtmlWithBreaks(reschedule)}</p>
    <p>${escapeHtml(whatsapp)}</p>
  `;
  const text = `Interview invitation for ${name}: ${when}. Format: ${format}. ${venue}`;
  return {
    subject: "Kufuor Scholars Program — Interview invitation",
    html,
    text,
    event: "interview_batch_assigned",
    template: "interview_batch",
  };
}

export function buildRescheduleNotificationEmail({
  applicantName,
  previous = {},
  next = {},
  schedule = {},
  allocation = {},
} = {}) {
  const name = applicantName || "Applicant";
  const nextWhen = formatAppointmentLabel(next.date, next.time, null);
  const previousWhen = formatAppointmentLabel(previous.date, previous.time, null);
  const venue =
    allocation.interview_format === INTERVIEW_FORMATS.virtual
      ? "Virtual interview — use the meeting instructions in the applicant portal."
      : schedule.physical_venue || next.location || "Venue will be confirmed by the recruitment team.";
  const html = `
    <p>Dear ${escapeHtml(name)},</p>
    <p>Your Kufuor Scholars Program interview has been rescheduled.</p>
    <ul>
      <li><strong>Previous date and time:</strong> ${escapeHtml(previousWhen || "your previous batch")}</li>
      <li><strong>New date and time:</strong> ${escapeHtml(nextWhen)}</li>
      <li><strong>Location / access:</strong> ${escapeHtml(venue)}</li>
    </ul>
    <p>Please arrive at least 15 minutes before your assigned batch begins. Sign in to the applicant portal to confirm attendance.</p>
    <p>${escapeHtml(schedule.whatsapp_contact ? `Official WhatsApp contact: ${schedule.whatsapp_contact}` : "")}</p>
  `;
  const text = `Interview rescheduled for ${name}. Previous: ${previousWhen}. New: ${nextWhen}. ${venue}`;
  return {
    subject: "Kufuor Scholars Program — Interview rescheduled",
    html,
    text,
    event: "interview_batch_updated",
    template: "interview_batch_change",
  };
}
