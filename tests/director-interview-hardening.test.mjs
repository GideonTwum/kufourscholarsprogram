import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertBatchAssignmentCapacity,
  createBatchCapacityStore,
  isInvitationAlreadySent,
  isInvitationRetryable,
  recordInvitationSendResult,
  summarizeInvitationDelivery,
} from "../lib/director-interview-capacity.js";
import { deliverBatchInvitations } from "../lib/director-interview-publish.js";
import {
  previewInterviewInvitations,
  buildRescheduleNotificationEmail,
} from "../lib/director-interview-invitations.js";
import { persistDirectorInterviewAllocations } from "../lib/director-interview-allocation.js";
import {
  validateApplicantInterviewResponse,
  requestDoesNotChangeAppointment,
} from "../lib/interview-applicant-response.js";
import { hasLocationConfirmation } from "../lib/director-location-filter.js";
import { INTERVIEW_FORMATS } from "../lib/director-interview-appointments.js";

const slot = { id: "s1", capacity: 2, status: "scheduled" };

test("Concurrent bulk assignments cannot overbook a batch", async () => {
  const store = createBatchCapacityStore({
    slot,
    occupantIds: [],
  });
  const [first, second] = await Promise.all([
    store.assign(["a", "b"]),
    store.assign(["c", "d"]),
  ]);
  const successes = [first, second].filter((result) => result.ok);
  const failures = [first, second].filter((result) => !result.ok);
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].error, "insufficient_batch_capacity");
  assert.equal(store.occupancy(), 2);
});

test("Capacity enforcement rejects a third applicant on a full batch", () => {
  const result = assertBatchAssignmentCapacity({
    slot,
    occupantIds: ["a", "b"],
    selectedIds: ["c"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "insufficient_batch_capacity");
  assert.equal(result.available, 0);
});

test("Published assignments cannot be overwritten and one applicant stays on one batch", () => {
  const published = assertBatchAssignmentCapacity({
    slot,
    occupantIds: ["a"],
    selectedIds: ["locked"],
    publishedAllocations: { locked: true },
  });
  assert.equal(published.skipped[0].reason, "published_locked");
  const other = assertBatchAssignmentCapacity({
    slot,
    occupantIds: [],
    selectedIds: ["x"],
    publishedByApplicant: { x: "other-slot" },
  });
  assert.equal(other.skipped[0].reason, "already_on_published_batch");
});

test("Partial email failures are not marked sent and can be retried", async () => {
  const sends = [];
  const updates = [];
  const admin = {
    from() {
      return {
        update(patch) {
          updates.push(patch);
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
  };
  const delivered = await deliverBatchInvitations({
    rows: [
      {
        id: "ok",
        full_name: "Ama",
        email: "ama@example.com",
        allocation: { interview_format: "in_person" },
      },
      {
        id: "fail",
        full_name: "Kofi",
        email: "kofi@example.com",
        allocation: { interview_format: "in_person" },
      },
    ],
    schedule: { physical_venue: "Accra" },
    slot: { id: "s1", interview_date: "2026-11-17", interview_time: "08:00", end_time: "09:00", location: "Accra" },
    admin,
    async sendKspEmail({ to }) {
      sends.push(to);
      if (to === "kofi@example.com") return { ok: false, sent: false, reason: "resend_timeout" };
      return { ok: true, sent: true };
    },
  });
  assert.equal(delivered.notified, 1);
  assert.equal(delivered.failed_count, 1);
  assert.equal(delivered.partial, true);
  assert.equal(updates[0].invitation_delivery_status, "sent");
  assert.equal(updates[1].invitation_sent_at, null);
  assert.equal(updates[1].invitation_delivery_status, "failed");
  const retryRow = {
    id: "fail",
    allocation: { invitation_delivery_status: "failed", invitation_sent_at: null },
  };
  assert.equal(isInvitationAlreadySent(retryRow), false);
  assert.equal(isInvitationRetryable(retryRow), true);
});

test("Duplicate publish requests skip already-sent invitations", () => {
  const recorded = recordInvitationSendResult(
    { invitation_sent_at: "2026-11-01", invitation_delivery_status: "sent" },
    { ok: true, sent: true }
  );
  assert.equal(recorded.duplicate, true);
  const preview = previewInterviewInvitations({
    schedule: { physical_venue: "Accra" },
    slot: { id: "s1", interview_date: "2026-11-17", interview_time: "08:00", location: "Accra" },
    rows: [
      {
        id: "a",
        email: "ama@example.com",
        allocation: { invitation_sent_at: "2026-11-01", interview_format: "in_person" },
      },
    ],
  });
  assert.equal(preview.already_published, 1);
  assert.equal(preview.ready_count, 0);
});

test("Failed send result is not treated as success", () => {
  const recorded = recordInvitationSendResult({}, { ok: false, sent: false, reason: "no_api_key" });
  assert.equal(recorded.invitation_sent_at, null);
  assert.equal(recorded.invitation_delivery_status, "failed");
});

test("Reschedule notification records previous and new times", () => {
  const email = buildRescheduleNotificationEmail({
    applicantName: "Ama Mensah",
    previous: { date: "2026-11-17", time: "08:00–09:00 GMT" },
    next: { date: "2026-11-18", time: "13:00–14:00 GMT", location: "Accra" },
    schedule: { physical_venue: "Accra", whatsapp_contact: "+233" },
  });
  assert.match(email.html, /Ama Mensah/);
  assert.match(email.html, /rescheduled/i);
  assert.match(email.html, /2026/);
  assert.equal(email.event, "interview_batch_updated");
  const req = readFileSync(resolve("app/api/director/interview-requests/route.js"), "utf8");
  assert.match(req, /reschedule_interview_batch_assignment/);
  assert.match(req, /retry_notification/);
  assert.match(req, /sendKspEmail/);
  assert.match(req, /previous_interview_date/);
});

test("Existing published slots remain compatible and are not re-invited without sent marker logic", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/202611010004_interview_batch_hardening.sql"),
    "utf8"
  );
  assert.match(sql, /invitation_sent_at = COALESCE/);
  assert.doesNotMatch(sql, /UPDATE public\.applications\s+SET\s+status/i);
  assert.match(sql, /assign_interview_batch_applicants/);
  const synthetic = {
    allocation: {
      invitation_sent_at: "legacy",
      invitation_delivery_status: "sent",
    },
  };
  assert.equal(isInvitationAlreadySent(synthetic), true);
});

test("Study-region confirmation is still required and not inferred from residence", () => {
  assert.equal(hasLocationConfirmation({ location_confirmation: { confirmed_region: "Northern" } }), false);
  assert.equal(
    hasLocationConfirmation({
      location_confirmation: {
        confirmed_region: "Northern",
        confirmed_town: "Tamale",
        study_institution: "UDS",
      },
    }),
    true
  );
  const loc = readFileSync(resolve("lib/director-location-filter.js"), "utf8");
  assert.match(loc, /Never hometown/);
  assert.doesNotMatch(loc, /app\.hometown|applications\.hometown/);
});

test("Virtual interview approval stays director-controlled", () => {
  const ok = validateApplicantInterviewResponse({
    action: "virtual",
    reason: "Currently studying in Tamale this semester",
  });
  assert.equal(ok.request_type, "virtual");
  assert.equal(requestDoesNotChangeAppointment().autoApprove, false);
  const req = readFileSync(resolve("app/api/director/interview-requests/route.js"), "utf8");
  assert.match(req, /meeting_link required to approve a virtual interview/);
  assert.equal(INTERVIEW_FORMATS.virtual, "virtual");
});

test("Applicant attendance responses do not change the batch", () => {
  const attend = validateApplicantInterviewResponse({ action: "confirm_attendance" });
  assert.equal(attend.response_status, "attendance_confirmed");
  const applicant = readFileSync(resolve("app/api/applicant/interview/route.js"), "utf8");
  assert.match(applicant, /appointment_unchanged: true/);
  assert.equal(requestDoesNotChangeAppointment().releasesAppointment, false);
});

test("allocate_batch persist uses the locking RPC", async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: { ok: true, assigned: 1 }, error: null };
    },
    from() {
      calls.push({ name: "from" });
      return { upsert: async () => ({ error: null }) };
    },
  };
  const persisted = await persistDirectorInterviewAllocations(client, {
    plan: {
      ok: true,
      action: "allocate_batch",
      changing: [{ id: "app-1", next: { interview_slot_id: "s1", interview_format: "in_person" } }],
    },
    actorId: "dir",
    interviewSlot: { id: "s1" },
  });
  assert.equal(persisted.error, null);
  assert.equal(calls[0].name, "assign_interview_batch_applicants");
  assert.equal(calls.some((call) => call.name === "from"), false);
});

test("Invitation delivery summary is visible to directors", () => {
  const summary = summarizeInvitationDelivery([
    { invitation_delivery_status: "sent" },
    { invitation_delivery_status: "failed" },
    { invitation_delivery_status: "pending" },
  ]);
  assert.equal(summary.sent, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.pending, 1);
  const ui = readFileSync(resolve("components/director/DirectorPublishedInterviews.jsx"), "utf8");
  assert.match(ui, /Invitations:/);
  assert.match(ui, /Retry failed invitations/);
});

test("Hardening migration is additive and 001 stays frozen", () => {
  assert.ok(existsSync(resolve("supabase/migrations/202611010004_interview_batch_hardening.sql")));
  const applied = readFileSync(
    resolve("supabase/migrations/202610300001_interview_allocation.sql"),
    "utf8"
  );
  assert.match(applied, /ALREADY APPLIED/);
  const create = readFileSync(resolve("app/api/director/interview-allocations/route.js"), "utf8");
  assert.doesNotMatch(create, /sendKspEmail/);
  const slots = readFileSync(resolve("app/api/interview-slots/route.js"), "utf8");
  assert.match(slots, /confirm === true/);
  assert.match(slots, /failed_count/);
});
