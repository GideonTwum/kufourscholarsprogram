import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  appointmentsOverlap,
  generateInterviewAppointments,
  nextAvailableAppointments,
  partitionAppointmentsForRegen,
  planSequentialAppointmentAssignments,
  summarizeAppointmentCapacity,
} from "../lib/director-interview-appointments.js";
import {
  planDirectorInterviewAllocations,
  persistDirectorInterviewAllocations,
} from "../lib/director-interview-allocation.js";
import {
  buildInterviewInvitationEmail,
  previewInterviewInvitations,
} from "../lib/director-interview-invitations.js";
import {
  interviewModeLabel,
  interviewResponseLabel,
  requestDoesNotChangeAppointment,
  validateApplicantInterviewResponse,
} from "../lib/interview-applicant-response.js";

const BREAKS = [{ start_time: "12:00", end_time: "12:30" }];

test("Dynamic interview dates stay schedule-backed", () => {
  const src = readFileSync(resolve("lib/director-interview-appointments.js"), "utf8");
  assert.doesNotMatch(src, /capacity = 75/);
  assert.doesNotMatch(src, /TOTAL_CAPACITY/);
});

test("Six-minute appointment generation and daily break exclusion", () => {
  const generated = generateInterviewAppointments({
    startTime: "08:00",
    endTime: "16:00",
    durationMinutes: 6,
    breaks: BREAKS,
  });
  assert.equal(generated.ok, true);
  assert.equal(generated.capacity, 75);
  assert.equal(generated.appointments[0].start_time, "08:00");
  assert.equal(generated.appointments[0].end_time, "08:06");
  assert.equal(
    generated.appointments.some((apt) => apt.start_time === "12:00" || apt.start_time === "12:24"),
    false
  );
  const afterBreak = generated.appointments.find((apt) => apt.start_time === "12:30");
  assert.ok(afterBreak);
  assert.equal(afterBreak.end_time, "12:36");
});

test("Correct capacity calculation is dynamic", () => {
  const five = generateInterviewAppointments({
    startTime: "08:00",
    endTime: "16:00",
    durationMinutes: 5,
    breaks: BREAKS,
  });
  assert.notEqual(five.capacity, 75);
  const noBreak = generateInterviewAppointments({
    startTime: "08:00",
    endTime: "16:00",
    durationMinutes: 6,
    breaks: [],
  });
  assert.equal(noBreak.capacity, 80);
});

test("No overlapping appointments and single-panel scheduling", () => {
  const generated = generateInterviewAppointments({
    startTime: "08:00",
    endTime: "10:00",
    durationMinutes: 6,
    breaks: [],
  });
  for (let i = 1; i < generated.appointments.length; i += 1) {
    assert.equal(
      appointmentsOverlap(generated.appointments[i - 1], generated.appointments[i]),
      false
    );
  }
});

test("Individual and bulk sequential allocation", () => {
  const available = [
    { id: "a1", start_time: "08:00", end_time: "08:06", schedule_day_id: "d1" },
    { id: "a2", start_time: "08:06", end_time: "08:12", schedule_day_id: "d1" },
  ];
  const sequential = planSequentialAppointmentAssignments({
    selectedIds: ["app-1", "app-2"],
    availableAppointments: available,
  });
  assert.equal(sequential.ok, true);
  assert.equal(sequential.assignments[0].appointment_id, "a1");
  assert.equal(sequential.assignments[1].appointment_id, "a2");
  const short = planSequentialAppointmentAssignments({
    selectedIds: ["app-1", "app-2", "app-3"],
    availableAppointments: available,
  });
  assert.equal(short.error, "insufficient_appointments");
});

test("Concurrent allocation attempts collide on one appointment", () => {
  const taken = { a1: { application_id: "other" } };
  const available = nextAvailableAppointments(
    [{ id: "a1", start_time: "08:00", end_time: "08:06" }],
    taken
  );
  assert.equal(available.length, 0);
});

test("Reallocation and unassignment skip published appointments", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [{ id: "app-1", status: "stage_2_approved" }],
    allocationsById: {
      "app-1": { allocation_state: "physical", schedule_day_id: "d1", published_at: "2026-11-01" },
    },
    selectedIds: ["app-1"],
    action: "unallocate",
    days: [{ id: "d1", interview_date: "2026-11-17", start_time: "08:00", end_time: "16:00", is_active: true }],
  });
  assert.equal(plan.changing.length, 0);
  assert.equal(plan.skipped[0].reason, "published_locked");
});

test("Protected appointments are not regenerated", () => {
  const existing = [
    { id: "keep", start_time: "08:00", end_time: "08:06" },
    { id: "free", start_time: "08:06", end_time: "08:12" },
  ];
  const generated = [
    { start_time: "08:00", end_time: "08:06" },
    { start_time: "08:06", end_time: "08:12" },
  ];
  const part = partitionAppointmentsForRegen(existing, generated, {
    keep: { application_id: "app-1" },
  });
  assert.deepEqual(part.deletableIds, ["free"]);
  assert.equal(part.protectedRows[0].id, "keep");
});

test("Virtual interview requests need a reason and stay pending", () => {
  const missing = validateApplicantInterviewResponse({ action: "virtual" });
  assert.equal(missing.error, "reason_required");
  const ok = validateApplicantInterviewResponse({
    action: "virtual",
    reason: "Currently studying in Tamale this semester",
  });
  assert.equal(ok.request_type, "virtual");
  assert.equal(requestDoesNotChangeAppointment().autoApprove, false);
});

test("Interview mode labels distinguish request, approval, and in-person", () => {
  assert.equal(interviewModeLabel({ interviewFormat: "in_person" }), "In-person");
  assert.equal(
    interviewModeLabel({ interviewFormat: "in_person", responseStatus: "virtual_requested" }),
    "Virtual — Requested"
  );
  assert.equal(interviewModeLabel({ interviewFormat: "virtual" }), "Virtual — Approved");
  assert.equal(interviewResponseLabel("attendance_confirmed"), "Attendance Confirmed");
  assert.equal(interviewResponseLabel("reschedule_requested"), "Rescheduling Requested");
});

test("Attendance confirmation and rescheduling requests", () => {
  const attend = validateApplicantInterviewResponse({ action: "confirm_attendance" });
  assert.equal(attend.response_status, "attendance_confirmed");
  const reschedule = validateApplicantInterviewResponse({
    action: "reschedule",
    reason: "Examination clash on the assigned morning",
  });
  assert.equal(reschedule.request_type, "reschedule");
  assert.equal(requestDoesNotChangeAppointment().releasesAppointment, false);
});

test("Invitation publication previews blockers and builds email", () => {
  const preview = previewInterviewInvitations({
    schedule: { physical_venue: "" },
    slot: { id: "s1", interview_date: "2026-11-17", interview_time: "08:00", end_time: "09:00" },
    rows: [
      {
        id: "a",
        full_name: "Ama",
        email: "ama@example.com",
        allocation: { interview_format: "in_person" },
        slot: { id: "s1", interview_date: "2026-11-17", interview_time: "08:00", end_time: "09:00" },
      },
    ],
  });
  assert.equal(preview.blocked_count, 1);
  const email = buildInterviewInvitationEmail({
    applicantName: "Ama",
    appointment: { interview_date: "2026-11-17", start_time: "08:00", end_time: "08:06" },
    allocation: { interview_format: "in_person" },
    schedule: { physical_venue: "Accra", policy_wording: "in person" },
  });
  assert.match(email.html, /Ama/);
  assert.match(email.html, /in person/i);
  const defaultEmail = buildInterviewInvitationEmail({
    applicantName: "Ama",
    appointment: { interview_date: "2026-11-17", start_time: "08:00", end_time: "08:06" },
    allocation: { interview_format: "in_person" },
    schedule: { physical_venue: "Accra" },
  });
  assert.match(defaultEmail.html, /currently studying in northern Ghana/);
  assert.doesNotMatch(defaultEmail.html, /hometown|residential/i);
});

test("Duplicate-email prevention treats published allocations as already sent", () => {
  const preview = previewInterviewInvitations({
    schedule: { physical_venue: "Accra" },
    slot: { id: "s1", interview_date: "2026-11-17", interview_time: "08:00", location: "Accra" },
    rows: [
      {
        id: "a",
        email: "ama@example.com",
        allocation: {
          interview_format: "in_person",
          published_at: "2026-11-01",
          invitation_sent_at: "2026-11-01",
        },
        slot: { id: "s1", interview_date: "2026-11-17", interview_time: "08:00", location: "Accra" },
      },
    ],
  });
  assert.equal(preview.already_published, 1);
  assert.equal(preview.ready_count, 0);
});

test("Applicant privacy and director authorization", () => {
  const applicantApi = readFileSync(resolve("app/api/applicant/interview/route.js"), "utf8");
  assert.match(applicantApi, /requireApplicant/);
  assert.match(applicantApi, /eq\("user_id", userId\)/);
  assert.doesNotMatch(applicantApi, /self-book appointment/);
  const dir = readFileSync(resolve("app/api/director/interview-appointments/route.js"), "utf8");
  assert.match(dir, /requireActiveDirector/);
  assert.doesNotMatch(dir, /sendKspEmail/);
  const invite = readFileSync(resolve("app/api/director/interview-invitations/route.js"), "utf8");
  assert.match(invite, /sendKspEmail/);
  assert.match(invite, /confirm !== true/);
});

test("Existing published-interview compatibility and Stage 2 preservation", () => {
  const published = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  assert.match(published, /\/api\/interview-slots/);
  const persistSrc = readFileSync(resolve("lib/director-interview-allocation.js"), "utf8");
  assert.doesNotMatch(persistSrc, /from\("applications"\)\s*\.update/);
  assert.ok(existsSync(resolve("supabase/migrations/202611010001_interview_timetable.sql")));
  const sql = readFileSync(resolve("supabase/migrations/202611010001_interview_timetable.sql"), "utf8");
  assert.match(sql, /interview_appointments/);
  assert.doesNotMatch(sql, /UPDATE public\.applications SET status/);
  const applied = readFileSync(
    resolve("supabase/migrations/202610300001_interview_allocation.sql"),
    "utf8"
  );
  assert.match(applied, /ALREADY APPLIED/);
});

test("Capacity occupancy summary", () => {
  const appointments = [
    { id: "1" },
    { id: "2" },
    { id: "3", is_held: true },
  ];
  const summary = summarizeAppointmentCapacity(appointments, {
    1: { application_id: "a", published_at: "x" },
  });
  assert.equal(summary.total, 3);
  assert.equal(summary.booked, 1);
  assert.equal(summary.published, 1);
  assert.equal(summary.held, 1);
  assert.equal(summary.available, 1);
});

test("persist appointment assignment writes allocations only", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(table);
      return {
        upsert: async () => ({ error: null }),
        delete() {
          return { in: async () => ({ error: null }) };
        },
      };
    },
  };
  await persistDirectorInterviewAllocations(client, {
    plan: {
      ok: true,
      changing: [
        {
          id: "app-1",
          next: {
            allocation_state: "physical",
            schedule_day_id: "d1",
            appointment_id: "a1",
            schedule_id: "s1",
          },
        },
      ],
    },
    actorId: "dir",
  });
  assert.equal(calls.includes("applications"), false);
});
