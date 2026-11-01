/**
 * Assignment visibility and duplicate-prevention helpers for interview_slots.
 * Draft assignments live on application_interview_allocations.interview_slot_id.
 * Published assignments also appear on applications.interview_slot_id.
 */

export const ASSIGNMENT_FILTERS = Object.freeze([
  { key: "", label: "All Applicants" },
  { key: "unassigned", label: "Not Assigned" },
  { key: "assigned", label: "Assigned" },
]);

export function formatAssignedBatchLabel(slot) {
  if (!slot) return "";
  const time = [slot.interview_time, slot.end_time].filter(Boolean).join("–") || "";
  return [slot.batch_name || "Batch", slot.interview_date, time].filter(Boolean).join(" · ");
}

export function isCancelledInterviewSlot(slot) {
  return (slot?.status || "scheduled") === "cancelled";
}

export function presentApplicantAssignment(application, allocation = null, slotsById = {}) {
  const slotId = allocation?.interview_slot_id || application?.interview_slot_id || null;
  if (!slotId) {
    return {
      assignment_status: "unassigned",
      assigned_slot_id: null,
      assigned_batch_name: null,
      assigned_batch_date: null,
      assigned_batch_time: null,
      assigned_batch_label: null,
      assigned_published: false,
    };
  }
  const slot = slotsById[slotId] || null;
  if (slot && isCancelledInterviewSlot(slot)) {
    return {
      assignment_status: "unassigned",
      assigned_slot_id: null,
      assigned_batch_name: null,
      assigned_batch_date: null,
      assigned_batch_time: null,
      assigned_batch_label: null,
      assigned_published: false,
    };
  }
  if (!slot) {
    return {
      assignment_status: "assigned",
      assigned_slot_id: slotId,
      assigned_batch_name: "another batch",
      assigned_batch_date: null,
      assigned_batch_time: null,
      assigned_batch_label: "another batch",
      assigned_published: Boolean(allocation?.published_at || application?.interview_slot_id),
    };
  }
  const time = [slot.interview_time, slot.end_time].filter(Boolean).join("–") || null;
  const name = slot.batch_name || "Batch";
  return {
    assignment_status: "assigned",
    assigned_slot_id: slot.id,
    assigned_batch_name: name,
    assigned_batch_date: slot.interview_date || null,
    assigned_batch_time: time,
    assigned_batch_label: formatAssignedBatchLabel(slot),
    assigned_published: Boolean(
      allocation?.published_at ||
        application?.interview_slot_id === slot.id ||
        slot.published_at ||
        slot.invitation_sent_at
    ),
  };
}

export function assignmentRowState(assignment, targetBatchId = "") {
  if (!assignment || assignment.assignment_status !== "assigned" || !assignment.assigned_slot_id) {
    return {
      kind: "unassigned",
      status_label: "Not Assigned",
      selectable: true,
      can_move: false,
      reason: null,
    };
  }
  const batchName = assignment.assigned_batch_name || "another batch";
  const label = assignment.assigned_batch_label || batchName;
  if (targetBatchId && assignment.assigned_slot_id === targetBatchId) {
    return {
      kind: "this_batch",
      status_label: "Assigned to This Batch",
      selectable: false,
      can_move: false,
      reason: "This applicant is already assigned to the selected batch.",
    };
  }
  if (assignment.assigned_published) {
    return {
      kind: "other_batch",
      status_label: `Assigned to ${batchName}`,
      selectable: false,
      can_move: false,
      reason: `Already assigned to ${label}. Published assignments can only be changed through Applicant Responses.`,
    };
  }
  return {
    kind: "other_batch",
    status_label: `Assigned to ${batchName}`,
    selectable: false,
    can_move: Boolean(targetBatchId),
    reason: `Already assigned to ${label}. Use Move to assign them to the selected batch.`,
  };
}

export function summarizeAssignmentCounts(applicants = []) {
  const total = applicants.length;
  const assigned = applicants.filter((app) => app?.assigned_slot_id).length;
  return {
    total,
    assigned,
    unassigned: total - assigned,
  };
}

export function currentActiveAssignmentSlotId(application, allocation = null, slotsById = {}) {
  return presentApplicantAssignment(application, allocation, slotsById).assigned_slot_id;
}

export function duplicateAssignmentConflict({
  application,
  allocation = null,
  destinationSlotId,
  allowMove = false,
  slotsById = {},
} = {}) {
  const current = presentApplicantAssignment(application, allocation, slotsById);
  if (!current.assigned_slot_id || current.assigned_slot_id === destinationSlotId) return null;
  if (current.assigned_published || application?.interview_slot_id) {
    return {
      reason: allocation?.published_at ? "published_locked" : "already_on_published_batch",
      assigned_slot_id: current.assigned_slot_id,
      assigned_batch_label: current.assigned_batch_label,
    };
  }
  if (!allowMove) {
    return {
      reason: "already_assigned_other_batch",
      assigned_slot_id: current.assigned_slot_id,
      assigned_batch_label: current.assigned_batch_label,
    };
  }
  return null;
}
