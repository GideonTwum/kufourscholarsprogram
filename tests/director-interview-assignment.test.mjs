import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ASSIGNMENT_FILTERS,
  assignmentRowState,
  duplicateAssignmentConflict,
  presentApplicantAssignment,
  summarizeAssignmentCounts,
} from "../lib/director-interview-assignment.js";
import { planDirectorInterviewAllocations } from "../lib/director-interview-allocation.js";

const batch1 = {
  id: "slot-1",
  batch_name: "Batch 1",
  interview_date: "2026-11-17",
  interview_time: "08:00",
  end_time: "09:00",
  status: "scheduled",
};
const batch2 = {
  id: "slot-2",
  batch_name: "Batch 2",
  interview_date: "2026-11-17",
  interview_time: "09:00",
  end_time: "10:00",
  status: "scheduled",
};
const slotsById = { "slot-1": batch1, "slot-2": batch2 };

test("Draft allocations show assigned status even when applications.interview_slot_id is empty", () => {
  const assignment = presentApplicantAssignment(
    { id: "app-1", status: "interview_review_pending", interview_slot_id: null },
    { interview_slot_id: "slot-1" },
    slotsById
  );
  assert.equal(assignment.assignment_status, "assigned");
  assert.equal(assignment.assigned_slot_id, "slot-1");
  assert.equal(assignment.assigned_published, false);
  assert.match(assignment.assigned_batch_label, /Batch 1/);
  assert.match(assignment.assigned_batch_label, /08:00/);
});

test("Row state distinguishes this batch, another batch, and unassigned", () => {
  const assigned = presentApplicantAssignment(
    { id: "app-1", interview_slot_id: null },
    { interview_slot_id: "slot-1" },
    slotsById
  );
  const unassigned = assignmentRowState(presentApplicantAssignment({ id: "app-2" }, null, slotsById), "slot-1");
  const here = assignmentRowState(assigned, "slot-1");
  const other = assignmentRowState(assigned, "slot-2");
  assert.equal(unassigned.kind, "unassigned");
  assert.equal(unassigned.status_label, "Not Assigned");
  assert.equal(unassigned.selectable, true);
  assert.equal(here.kind, "this_batch");
  assert.equal(here.status_label, "Assigned to This Batch");
  assert.equal(here.selectable, false);
  assert.equal(other.kind, "other_batch");
  assert.match(other.status_label, /Assigned to Batch 1/);
  assert.equal(other.selectable, false);
  assert.equal(other.can_move, true);
});

test("Published assignments cannot be selected or moved from the shortlist", () => {
  const assignment = presentApplicantAssignment(
    { id: "app-1", interview_slot_id: "slot-1", status: "called_for_interview" },
    { interview_slot_id: "slot-1", published_at: "2026-11-01" },
    slotsById
  );
  const other = assignmentRowState(assignment, "slot-2");
  assert.equal(other.can_move, false);
  assert.match(other.reason, /Published assignments/);
});

test("Duplicate assignment is rejected unless an explicit move is requested", () => {
  const conflict = duplicateAssignmentConflict({
    application: { id: "app-1", interview_slot_id: null },
    allocation: { interview_slot_id: "slot-1" },
    destinationSlotId: "slot-2",
    allowMove: false,
    slotsById,
  });
  assert.equal(conflict.reason, "already_assigned_other_batch");
  const allowed = duplicateAssignmentConflict({
    application: { id: "app-1", interview_slot_id: null },
    allocation: { interview_slot_id: "slot-1" },
    destinationSlotId: "slot-2",
    allowMove: true,
    slotsById,
  });
  assert.equal(allowed, null);
});

test("allocate_batch skips applicants already on another draft batch", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [{ id: "app-1", status: "interview_review_pending" }],
    allocationsById: {
      "app-1": { allocation_state: "physical", interview_slot_id: "slot-1" },
    },
    selectedIds: ["app-1"],
    action: "allocate_batch",
    interviewSlot: batch2,
    slotsById,
  });
  assert.equal(plan.changing.length, 0);
  assert.equal(plan.skipped[0].reason, "already_assigned_other_batch");
  assert.equal(plan.notifyApplicants, false);
});

test("allocate_batch allowMove moves a draft assignment atomically in plan", () => {
  const plan = planDirectorInterviewAllocations({
    applications: [{ id: "app-1", status: "interview_review_pending" }],
    allocationsById: {
      "app-1": { allocation_state: "physical", interview_slot_id: "slot-1" },
    },
    selectedIds: ["app-1"],
    action: "allocate_batch",
    interviewSlot: batch2,
    allowMove: true,
    slotsById,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.changing[0].next.interview_slot_id, "slot-2");
  assert.equal(plan.changing[0].previous.interview_slot_id, "slot-1");
  assert.equal(plan.notifyApplicants, false);
});

test("Assignment summary counts eligible, assigned, and unassigned", () => {
  const summary = summarizeAssignmentCounts([
    { assigned_slot_id: "slot-1" },
    { assigned_slot_id: "slot-1" },
    { assigned_slot_id: null },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.assigned, 2);
  assert.equal(summary.unassigned, 1);
  assert.deepEqual(
    ASSIGNMENT_FILTERS.map((item) => item.label),
    ["All Applicants", "Not Assigned", "Assigned"]
  );
});

test("Director Interviews shows assignment status, filters, and rejects silent moves", () => {
  const ui = readFileSync(resolve("components/director/DirectorPublishedInterviews.jsx"), "utf8");
  assert.match(ui, /Not Assigned/);
  assert.match(ui, /Assigned to This Batch/);
  assert.match(ui, /All Applicants/);
  assert.match(ui, /allow_move: true/);
  assert.match(ui, /Move to selected batch/);
  const get = readFileSync(resolve("app/api/director/interview-slots/route.js"), "utf8");
  assert.match(get, /assigned_slot_id/);
  assert.match(get, /shortlisted,/);
  assert.match(ui, /queue\?\.shortlisted/);
  const post = readFileSync(resolve("app/api/director/interview-allocations/route.js"), "utf8");
  assert.match(post, /already_assigned_other_batch/);
  assert.match(post, /status: 409/);
  assert.match(post, /notify_applicants: false/);
  assert.match(post, /allowMove/);
});
