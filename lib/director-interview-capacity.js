/**
 * Capacity and invitation-delivery rules for interview_slots batches.
 * PostgreSQL assign_interview_batch_applicants serializes the live writes.
 */

export const INVITATION_DELIVERY_STATUSES = Object.freeze({
  pending: "pending",
  sent: "sent",
  failed: "failed",
  skipped: "skipped",
});

export const NOTIFICATION_DELIVERY_STATUSES = Object.freeze({
  pending: "pending",
  sent: "sent",
  failed: "failed",
  not_required: "not_required",
});

export function uniqueApplicantIds(ids = []) {
  const out = [];
  const seen = new Set();
  for (const id of ids || []) {
    const key = String(id || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function occupancyExcluding(occupantIds = [], excludeIds = []) {
  const exclude = new Set(uniqueApplicantIds(excludeIds));
  return uniqueApplicantIds(occupantIds).filter((id) => !exclude.has(id)).length;
}

export function assertBatchAssignmentCapacity({
  slot = null,
  occupantIds = [],
  selectedIds = [],
  publishedByApplicant = {},
  publishedAllocations = {},
} = {}) {
  const ids = uniqueApplicantIds(selectedIds);
  if (!slot?.id) return { ok: false, error: "missing_batch", assigned: [], skipped: ids };
  if ((slot.status || "scheduled") === "cancelled") {
    return { ok: false, error: "batch_not_found", assigned: [], skipped: ids };
  }
  if (slot.published_at || slot.invitation_sent_at) {
    return { ok: false, error: "batch_already_published", assigned: [], skipped: ids };
  }

  const skipped = [];
  const assignable = [];
  for (const id of ids) {
    if (publishedAllocations[id]) {
      skipped.push({ id, reason: "published_locked" });
      continue;
    }
    const publishedSlot = publishedByApplicant[id];
    if (publishedSlot && publishedSlot !== slot.id) {
      skipped.push({ id, reason: "already_on_published_batch" });
      continue;
    }
    assignable.push(id);
  }

  const booked = occupancyExcluding(occupantIds, assignable);
  const capacity = Number(slot.capacity) > 0 ? Number(slot.capacity) : 0;
  const available = Math.max(0, capacity - booked);
  if (assignable.length > available) {
    return {
      ok: false,
      error: "insufficient_batch_capacity",
      assigned: [],
      skipped,
      available,
      needed: assignable.length,
      shortfall: assignable.length - available,
    };
  }

  return {
    ok: true,
    assigned: assignable,
    skipped,
    available: available - assignable.length,
    notifyApplicants: false,
  };
}

export function isInvitationAlreadySent(row = {}) {
  if (row?.allocation?.invitation_sent_at) return true;
  if (row?.allocation?.invitation_delivery_status === INVITATION_DELIVERY_STATUSES.sent) return true;
  return false;
}

export function isInvitationRetryable(row = {}) {
  if (isInvitationAlreadySent(row)) return false;
  const status = row?.allocation?.invitation_delivery_status;
  return status === INVITATION_DELIVERY_STATUSES.failed || status === INVITATION_DELIVERY_STATUSES.pending || !status;
}

export function recordInvitationSendResult(previous = {}, sendResult = {}) {
  if (isInvitationAlreadySent({ allocation: previous })) {
    return {
      invitation_sent_at: previous.invitation_sent_at,
      invitation_delivery_status: INVITATION_DELIVERY_STATUSES.sent,
      invitation_last_error: null,
      duplicate: true,
    };
  }
  if (sendResult?.ok && sendResult?.sent) {
    return {
      invitation_sent_at: sendResult.sentAt || new Date().toISOString(),
      invitation_delivery_status: INVITATION_DELIVERY_STATUSES.sent,
      invitation_last_error: null,
      duplicate: false,
    };
  }
  return {
    invitation_sent_at: null,
    invitation_delivery_status: INVITATION_DELIVERY_STATUSES.failed,
    invitation_last_error: sendResult?.reason || "send_failed",
    duplicate: false,
  };
}

export function summarizeInvitationDelivery(rows = []) {
  const summary = { sent: 0, pending: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    const status = row?.invitation_delivery_status || row?.allocation?.invitation_delivery_status;
    if (status === INVITATION_DELIVERY_STATUSES.sent || row?.invitation_sent_at) summary.sent += 1;
    else if (status === INVITATION_DELIVERY_STATUSES.failed) summary.failed += 1;
    else if (status === INVITATION_DELIVERY_STATUSES.skipped) summary.skipped += 1;
    else summary.pending += 1;
  }
  return summary;
}

export function mapAssignmentRpcResult(data, error) {
  if (error) {
    const message = String(error.message || error.details || "");
    if (/does not exist|42883/i.test(message)) {
      return { ok: false, error: "BATCH_LOCK_UNAVAILABLE", status: 503 };
    }
    if (/insufficient_batch_capacity/.test(message)) {
      return { ok: false, error: "insufficient_batch_capacity", status: 409 };
    }
    if (/batch_already_published/.test(message)) {
      return { ok: false, error: "batch_already_published", status: 409 };
    }
    if (/published_locked/.test(message)) {
      return { ok: false, error: "published_locked", status: 409 };
    }
    return { ok: false, error: message || "assignment_conflict", status: 409 };
  }
  const payload = data && typeof data === "object" ? data : {};
  if (payload.ok === false) {
    return {
      ok: false,
      error: payload.error || "assignment_conflict",
      status: 409,
      available: payload.available,
      needed: payload.needed,
      skipped: payload.skipped || [],
    };
  }
  return { ok: true, ...payload };
}

/**
 * In-memory FOR UPDATE stand-in for concurrency regression tests.
 * Callers share one store; assign() is serialized on a promise chain.
 */
export function createBatchCapacityStore({
  slot,
  occupantIds = [],
  publishedByApplicant = {},
  publishedAllocations = {},
} = {}) {
  const state = {
    slot: { ...slot },
    occupantIds: uniqueApplicantIds(occupantIds),
    byApplicant: Object.fromEntries(uniqueApplicantIds(occupantIds).map((id) => [id, slot.id])),
    publishedByApplicant: { ...publishedByApplicant },
    publishedAllocations: { ...publishedAllocations },
  };
  let queue = Promise.resolve();

  function assign(selectedIds) {
    const run = queue.then(() => {
      const result = assertBatchAssignmentCapacity({
        slot: state.slot,
        occupantIds: Object.keys(state.byApplicant),
        selectedIds,
        publishedByApplicant: state.publishedByApplicant,
        publishedAllocations: state.publishedAllocations,
      });
      if (!result.ok) return result;
      for (const id of result.assigned) state.byApplicant[id] = state.slot.id;
      return {
        ...result,
        occupancy: Object.keys(state.byApplicant).length,
      };
    });
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  return {
    assign,
    occupancy() {
      return Object.keys(state.byApplicant).length;
    },
    occupants() {
      return { ...state.byApplicant };
    },
  };
}
