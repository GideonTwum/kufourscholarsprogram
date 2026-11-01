import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  generateInterviewBatches,
  isInterviewSlotPublished,
  partitionDraftBatchesForRegen,
  planBatchAssignments,
  occupancyFromRows,
  applicationUpdateForPublishedBatch,
} from "../lib/director-interview-batches.js";
import { planDirectorInterviewAllocations } from "../lib/director-interview-allocation.js";
import {
  previewInterviewInvitations,
  buildInterviewInvitationEmail,
} from "../lib/director-interview-invitations.js";

const BREAKS = [{ start_time: "12:00", end_time: "12:30" }];
const dayA = {
  id: "day-a",
  interview_date: "2026-11-17",
  start_time: "08:00",
  end_time: "16:00",
  is_active: true,
  schedule_id: "sched-1",
};

test("Hourly batches subtract the daily break and keep a 12:30–13:00 partial batch", () => {
  const generated = generateInterviewBatches({
    startTime: "08:00",
    endTime: "16:00",
    durationMinutes: 6,
    breaks: BREAKS,
  });
  assert.equal(generated.ok, true);
  assert.equal(generated.capacity, 75);
  const noon = generated.batches.find((batch) => batch.start_time === "12:00");
  assert.equal(noon, undefined);
  const half = generated.batches.find((batch) => batch.start_time === "12:30");
  assert.ok(half);
  assert.equal(half.end_time, "13:00");
  assert.equal(half.capacity, 5);
  assert.equal(half.partial, true);
  const morning = generated.batches.find((batch) => batch.start_time === "08:00");
  assert.equal(morning.capacity, 10);
  assert.equal(morning.end_time, "09:00");
});

test("Batch generation stays configurable for other cycles", () => {
  const generated = generateInterviewBatches({
    startTime: "09:00",
    endTime: "15:00",
    durationMinutes: 5,
    breaks: [{ start_time: "12:00", end_time: "13:00" }],
  });
  assert.equal(generated.ok, true);
  assert.notEqual(generated.capacity, 75);
  assert.equal(
    generated.batches.some((batch) => batch.start_time === "12:00"),
    false
  );
});

test("Overbooking a batch is rejected", () => {
  const plan = planBatchAssignments({
    selectedIds: ["a", "b", "c"],
    slot: { id: "s1", capacity: 10, interview_time: "08:00", end_time: "09:00" },
    booked: 8,
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.error, "insufficient_batch_capacity");
  assert.equal(plan.available, 2);
});

test("Bulk assignment fills remaining batch capacity", () => {
  const plan = planBatchAssignments({
    selectedIds: ["a", "b"],
    slot: { id: "s1", capacity: 10 },
    booked: 8,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.assignments.length, 2);
  assert.equal(plan.notifyApplicants, false);
});

test("Published slots cannot be regenerated", () => {
  const part = partitionDraftBatchesForRegen(
    [
      { id: "keep", interview_time: "08:00", end_time: "09:00", published_at: "2026-11-01" },
      { id: "free", interview_time: "09:00", end_time: "10:00" },
    ],
    [
      { start_time: "08:00", end_time: "09:00", capacity: 10 },
      { start_time: "10:00", end_time: "11:00", capacity: 10 },
    ],
    { keep: 3 }
  );
  assert.deepEqual(part.deletableIds, ["free"]);
  assert.equal(part.protectedRows[0].id, "keep");
  assert.equal(part.toInsert[0].start_time, "10:00");
});

test("allocate_batch can use a batch without a schedule wizard date", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [{ id: "app-1", status: "stage_2_approved" }],
    allocationsById: {},
    selectedIds: ["app-1"],
    action: "allocate_batch",
    interviewSlot: { id: "slot-1", interview_date: "2026-11-17", capacity: 10 },
    assignments: [{ application_id: "app-1", interview_slot_id: "slot-1" }],
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.changing[0].next.interview_slot_id, "slot-1");
  assert.equal(plan.notifyApplicants, false);
});

test("Allocate_batch writes the slot and never notifies", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [{ id: "app-1", status: "stage_2_approved" }],
    allocationsById: {},
    selectedIds: ["app-1"],
    action: "allocate_batch",
    scheduleDay: dayA,
    days: [dayA],
    interviewSlot: { id: "slot-1", schedule_day_id: "day-a" },
    assignments: [{ application_id: "app-1", interview_slot_id: "slot-1" }],
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.changing[0].next.interview_slot_id, "slot-1");
  assert.equal(plan.notifyApplicants, false);
  assert.equal(plan.preserveApplicationStatus, true);
});

test("Published allocations cannot be moved between batches", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [{ id: "app-1", status: "stage_2_approved" }],
    allocationsById: {
      "app-1": {
        allocation_state: "physical",
        schedule_day_id: "day-a",
        interview_slot_id: "old",
        published_at: "2026-11-01",
      },
    },
    selectedIds: ["app-1"],
    action: "allocate_batch",
    scheduleDay: dayA,
    days: [dayA],
    interviewSlot: { id: "slot-2", schedule_day_id: "day-a" },
  });
  assert.equal(plan.changing.length, 0);
  assert.equal(plan.skipped[0].reason, "published_locked");
});

test("Occupancy counts unique applicants only once", () => {
  const booked = occupancyFromRows([
    { application_id: "a", interview_slot_id: "s1" },
    { id: "a", interview_slot_id: "s1" },
    { id: "b", interview_slot_id: "s1" },
  ]);
  assert.equal(booked.s1, 2);
});

test("Publication skips already-notified applicants and requires a batch", () => {
  const slot = {
    id: "s1",
    interview_date: "2026-11-17",
    interview_time: "08:00",
    end_time: "09:00",
    location: "Accra",
  };
  const preview = previewInterviewInvitations({
    schedule: { physical_venue: "Accra" },
    slot,
    rows: [
      {
        id: "a",
        email: "ama@example.com",
        allocation: { invitation_sent_at: "2026-11-01", interview_format: "in_person" },
        application: { interview_slot_id: "s1", status: "called_for_interview" },
        slot,
      },
      {
        id: "b",
        email: "kofi@example.com",
        full_name: "Kofi",
        allocation: { interview_format: "in_person" },
        slot,
      },
    ],
  });
  assert.equal(preview.already_published, 1);
  assert.equal(preview.ready_count, 1);
});

test("Invitation copy uses batch reporting time and study-location virtual policy", () => {
  const email = buildInterviewInvitationEmail({
    applicantName: "Ama Mensah",
    allocation: { interview_format: "in_person" },
    schedule: { physical_venue: "JAK Foundation, Accra" },
    slot: {
      interview_date: "2026-11-17",
      interview_time: "08:00",
      end_time: "09:00",
      location: "JAK Foundation, Accra",
    },
  });
  assert.match(email.html, /Ama Mensah/);
  assert.match(email.html, /John A\. Kufuor Foundation 15 minutes before the assigned batch time/);
  assert.match(email.html, /three hard copies of an updated CV/);
  assert.match(email.html, /WASSCE and\/or NovDec/);
  assert.match(email.html, /currently studying in northern Ghana/);
  assert.match(email.html, /confirm attendance/);
  assert.match(email.html, /Official WhatsApp contact: 0246672876/);
  assert.doesNotMatch(email.html, /hometown|residential/i);
  assert.equal(email.event, "interview_batch_assigned");
});

test("Published application update keeps the interview_slots assignment", () => {
  const patch = applicationUpdateForPublishedBatch({
    slot: {
      id: "s1",
      interview_date: "2026-11-17",
      interview_time: "08:00",
      end_time: "09:00",
      location: "Accra",
    },
    schedule: { physical_venue: "Accra" },
  });
  assert.equal(patch.interview_slot_id, "s1");
  assert.equal(patch.status, "called_for_interview");
  assert.match(patch.interview_time, /08:00/);
});

test("Existing published slots are treated as already live", () => {
  assert.equal(isInterviewSlotPublished({ published_at: "2026-10-01" }), true);
  assert.equal(isInterviewSlotPublished({ invitation_sent_at: "2026-10-01" }), true);
  assert.equal(isInterviewSlotPublished({}), false);
});

test("Director Interviews UI is the manual batch workflow", () => {
  const workspace = readFileSync(
    resolve("components/director/DirectorInterviewsWorkspace.jsx"),
    "utf8"
  );
  const batches = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  const slots = readFileSync(resolve("app/api/interview-slots/route.js"), "utf8");
  assert.match(workspace, /Create a batch, assign shortlisted applicants/);
  assert.match(batches, /Create Batch/);
  assert.match(batches, /Publish and send invitations/);
  assert.match(batches, /application_ids: \[\]/);
  assert.match(slots, /notify_applicants: false/);
  assert.match(slots, /publish === true/);
  assert.doesNotMatch(workspace, /DirectorInterviewScheduleClient/);
  assert.doesNotMatch(workspace, /DirectorInterviewOverview/);
  assert.doesNotMatch(batches, /Generate hourly/);
});

test("Automatic hourly batch generation is disabled", () => {
  const generateRoutes = [
    "app/api/director/interview-batches/route.js",
    "app/api/director/interview-appointments/route.js",
  ];
  for (const path of generateRoutes) {
    const src = readFileSync(resolve(path), "utf8");
    assert.match(src, /MANUAL_BATCHES_REQUIRED/);
    assert.doesNotMatch(src, /interview_batches\.generated/);
    assert.doesNotMatch(src, /generateInterviewBatches/);
  }
});

test("Individual appointment publication is disabled and slots remain the publish path", () => {
  const invite = readFileSync(resolve("app/api/director/interview-invitations/route.js"), "utf8");
  assert.match(invite, /Individual appointment publication is disabled/);
  assert.match(invite, /sendKspEmail/);
  assert.match(invite, /confirm !== true/);
  const slots = readFileSync(resolve("app/api/interview-slots/route.js"), "utf8");
  assert.match(slots, /interview_batch_assigned/);
  assert.match(slots, /publish === true/);
  assert.match(slots, /notify_applicants: false/);
  const client = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  assert.doesNotMatch(client, /allocate_appointments/);
  assert.match(client, /cannot self-book/);
  const applicant = readFileSync(resolve("app/api/applicant/interview/route.js"), "utf8");
  assert.match(applicant, /appointment_unchanged: true/);
  assert.match(applicant, /interview_slot_id/);
  assert.doesNotMatch(applicant, /self-book appointment/);
});

test("Forward-only batch-drafts migration does not rewrite the applied allocation SQL", () => {
  assert.ok(existsSync(resolve("supabase/migrations/202611010003_interview_batch_drafts.sql")));
  const sql = readFileSync(resolve("supabase/migrations/202611010003_interview_batch_drafts.sql"), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS capacity/);
  assert.match(sql, /interview_slot_id/);
  assert.doesNotMatch(sql, /DROP TABLE/);
  const applied = readFileSync(
    resolve("supabase/migrations/202610300001_interview_allocation.sql"),
    "utf8"
  );
  assert.match(applied, /ALREADY APPLIED/);
});
