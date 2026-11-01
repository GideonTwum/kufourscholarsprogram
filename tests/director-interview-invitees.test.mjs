import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  UNIVERSITY_INVITEE_LABEL,
  createInviteeAccessToken,
  hashInviteeAccessToken,
  inviteeDuplicateConflict,
  occupancyIncludingInvitees,
  parseSelectionKeys,
  planCombinedBatchOccupancy,
  presentSpecialInvitee,
  shouldIssueInviteeToken,
  tokensMatch,
  validateSpecialInviteeInput,
  normalizeWhatsAppPhone,
} from "../lib/director-interview-invitees.js";
import {
  buildInviteeInvitationEmail,
  buildInviteeWhatsAppMessage,
} from "../lib/director-interview-invitations.js";
import { deliverInviteeInvitations } from "../lib/director-interview-publish.js";
import { isInvitationAlreadySent } from "../lib/director-interview-capacity.js";
import { validateApplicantInterviewResponse } from "../lib/interview-applicant-response.js";

const slot = {
  id: "batch-2",
  batch_name: "Batch 2",
  interview_date: "2026-11-17",
  interview_time: "09:00",
  end_time: "10:00",
  capacity: 10,
  location: "John A. Kufuor Foundation",
  status: "scheduled",
};
const slotsById = { "batch-2": slot, "batch-1": { ...slot, id: "batch-1", batch_name: "Batch 1" } };

test("Directors can register an international university invitee without creating an application", () => {
  const parsed = validateSpecialInviteeInput({
    full_name: "Adaeze Okonkwo",
    university: "University of Oxford",
    email: "adaeze@oxford.example",
    whatsapp_phone: "+44 7700 900123",
    nationality: "Nigerian",
    programme_of_study: "PPE",
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.source_type, "university_invitee");
  assert.equal(parsed.value.email_normalized, "adaeze@oxford.example");
  assert.equal(parsed.value.whatsapp_e164, "447700900123");
  const presented = presentSpecialInvitee({ id: "inv-1", ...parsed.value }, {});
  assert.equal(presented.source_label, UNIVERSITY_INVITEE_LABEL);
  assert.equal(presented.assignment_status, "unassigned");
});

test("Ghana WhatsApp numbers starting with 0 become international E.164", () => {
  const phone = normalizeWhatsAppPhone("0246672876");
  assert.equal(phone.ok, true);
  assert.equal(phone.e164, "233246672876");
  assert.equal(phone.waMe, "https://wa.me/233246672876");
});

test("Combined occupancy allows 7 applicants and 3 invitees on a batch of 10", () => {
  const ok = planCombinedBatchOccupancy({
    slot,
    bookedApplicants: 0,
    bookedInvitees: 0,
    selectedApplicantIds: ["a1", "a2", "a3", "a4", "a5", "a6", "a7"],
    selectedInviteeIds: ["i1", "i2", "i3"],
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.applicant_count, 7);
  assert.equal(ok.invitee_count, 3);
  assert.equal(ok.notify_applicants, false);
  const over = planCombinedBatchOccupancy({
    slot,
    bookedApplicants: 7,
    bookedInvitees: 0,
    selectedInviteeIds: ["i1", "i2", "i3", "i4"],
  });
  assert.equal(over.ok, false);
  assert.equal(over.error, "insufficient_batch_capacity");
  assert.equal(over.available, 3);
  const live = occupancyIncludingInvitees(
    Array.from({ length: 7 }, (_, i) => ({ id: `a${i}`, interview_slot_id: slot.id })),
    Array.from({ length: 3 }, (_, i) => ({ id: `i${i}`, interview_slot_id: slot.id }))
  );
  assert.equal(live[slot.id], 10);
});

test("Duplicate invitee assignment across batches is blocked unless moved", () => {
  const invitee = {
    id: "inv-1",
    full_name: "Adaeze Okonkwo",
    university: "Oxford",
    email: "adaeze@oxford.example",
    interview_slot_id: "batch-1",
  };
  const blocked = inviteeDuplicateConflict(invitee, "batch-2", { slotsById });
  assert.equal(blocked.reason, "already_assigned_other_batch");
  const move = inviteeDuplicateConflict(invitee, "batch-2", { allowMove: true, slotsById });
  assert.equal(move, null);
  const same = inviteeDuplicateConflict(invitee, "batch-1", { slotsById });
  assert.equal(same, null);
});

test("Invitee invitation uses approved wording and a secure confirm link", () => {
  const email = buildInviteeInvitationEmail({
    invitee: {
      full_name: "Adaeze Okonkwo",
      university: "University of Oxford",
      interview_format: "in_person",
    },
    schedule: { whatsapp_contact: "0246672876" },
    slot,
    confirmUrl: "https://kufourscholars.org/interview-invite/token-abc",
  });
  assert.match(email.html, /University Invitee/);
  assert.match(email.html, /University of Oxford/);
  assert.match(email.html, /John A\. Kufuor Foundation 15 minutes before the assigned batch time/);
  assert.match(email.html, /three hard copies of an updated CV/);
  assert.match(email.html, /one photocopy of your WASSCE and\/or NovDec results/);
  assert.match(email.html, /currently studying in northern Ghana/);
  assert.match(email.html, /Official WhatsApp contact: 0246672876/);
  assert.match(email.html, /interview-invite\/token-abc/);
  assert.doesNotMatch(email.html, /sign in to the applicant portal/i);
  assert.equal(email.event, "interview_invitee_assigned");
});

test("WhatsApp compose is ready but never claimed as sent", () => {
  const message = buildInviteeWhatsAppMessage({
    invitee: {
      full_name: "Adaeze Okonkwo",
      university: "University of Oxford",
      whatsapp_e164: "447700900123",
    },
    schedule: {},
    slot,
  });
  assert.equal(message.sent, false);
  assert.match(message.text, /University Invitee/);
  assert.match(message.text, /0246672876/);
  assert.match(message.waMe, /^https:\/\/wa\.me\/447700900123\?text=/);
});

test("Failed invitee email can be retried and already-sent recipients are skipped", async () => {
  const sent = [];
  const updates = [];
  const admin = {
    from() {
      return {
        update(patch) {
          updates.push(patch);
          return { eq() { return { error: null }; } };
        },
      };
    },
  };
  const first = await deliverInviteeInvitations({
    rows: [
      {
        id: "inv-new",
        email: "new@example.com",
        full_name: "New Invitee",
        invitee: { full_name: "New Invitee", university: "Oxford" },
        allocation: { interview_format: "in_person" },
      },
      {
        id: "inv-sent",
        email: "sent@example.com",
        full_name: "Already Sent",
        invitee: { full_name: "Already Sent", university: "Oxford", invitation_sent_at: "2026-11-01" },
        allocation: { invitation_sent_at: "2026-11-01", invitation_delivery_status: "sent" },
      },
    ],
    schedule: {},
    slot,
    issuedTokens: { "inv-new": "token-new" },
    siteUrl: "https://kufourscholars.org",
    sendKspEmail: async (payload) => {
      sent.push(payload);
      return { ok: false, sent: false, reason: "mock_delivery_failed" };
    },
    admin,
  });
  assert.equal(first.notified, 0);
  assert.equal(first.failed_count, 1);
  assert.equal(first.skippedDuplicate.length, 1);
  assert.equal(sent.length, 1);
  assert.equal(isInvitationAlreadySent({ allocation: { invitation_delivery_status: "sent" } }), true);
  assert.equal(shouldIssueInviteeToken({ invitation_delivery_status: "sent" }), false);
  assert.equal(shouldIssueInviteeToken({ invitation_delivery_status: "failed" }), true);

  const retry = await deliverInviteeInvitations({
    rows: [
      {
        id: "inv-new",
        email: "new@example.com",
        full_name: "New Invitee",
        invitee: { full_name: "New Invitee", university: "Oxford" },
        allocation: { interview_format: "in_person", invitation_delivery_status: "failed" },
      },
    ],
    schedule: {},
    slot,
    issuedTokens: { "inv-new": "token-retry" },
    siteUrl: "https://kufourscholars.org",
    sendKspEmail: async () => ({ ok: true, sent: true }),
    admin,
  });
  assert.equal(retry.notified, 1);
  assert.equal(retry.failed_count, 0);
});

test("Secure invitee tokens hash the raw value and attendance confirmation does not change the batch", () => {
  const issued = createInviteeAccessToken(new Date("2026-11-01T00:00:00Z"));
  assert.equal(tokensMatch(issued.token_hash, issued.token), true);
  assert.equal(tokensMatch(issued.token_hash, "other"), false);
  assert.equal(hashInviteeAccessToken(issued.token), issued.token_hash);
  const confirmed = validateApplicantInterviewResponse({ action: "confirm_attendance" });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.response_status, "attendance_confirmed");
});

test("Selection keys keep applicants and invitees separate", () => {
  const parsed = parseSelectionKeys(["a:app-1", "i:inv-1", "app-2"]);
  assert.deepEqual(parsed.application_ids, ["app-1", "app-2"]);
  assert.deepEqual(parsed.invitee_ids, ["inv-1"]);
});

test("Invitee schema is a minimum extension and does not fake applications", () => {
  const sql = readFileSync(resolve("supabase/migrations/202611010005_interview_special_invitees.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.interview_special_invitees/);
  assert.match(sql, /source_type text NOT NULL DEFAULT 'university_invitee'/);
  assert.match(sql, /access_token_hash/);
  assert.match(sql, /assign_interview_batch_invitees/);
  assert.match(sql, /interview_slot_occupancy/);
  assert.match(sql, /is_director\(\)/);
  assert.doesNotMatch(sql, /INSERT INTO public\.applications/);
  assert.doesNotMatch(sql, /UPDATE public\.applications/);
  assert.doesNotMatch(sql, /ON public\.applications/);
  assert.doesNotMatch(sql, /ON public\.application_interview_allocations/);
  assert.ok(existsSync(resolve("supabase-migration-interview-special-invitees.sql")));
});

test("Interviews workspace and public confirm page include special invitees", () => {
  const workspace = readFileSync(resolve("components/director/DirectorInterviewsWorkspace.jsx"), "utf8");
  assert.match(workspace, /Special Invitees/);
  const panel = readFileSync(resolve("components/director/DirectorSpecialInviteesPanel.jsx"), "utf8");
  assert.match(panel, /University invitee/);
  assert.match(panel, /No messages were sent/);
  assert.match(panel, /The portal does not send WhatsApp messages/);
  const published = readFileSync(resolve("components/director/DirectorPublishedInterviews.jsx"), "utf8");
  assert.match(published, /university invitees/);
  assert.match(published, /planCombinedBatchOccupancy/);
  const page = readFileSync(resolve("app/(public)/interview-invite/[token]/page.js"), "utf8");
  assert.match(page, /Confirm attendance/);
  const api = readFileSync(resolve("app/api/interview-invite/[token]/route.js"), "utf8");
  assert.match(api, /appointment_unchanged: true/);
  const proxy = readFileSync(resolve("proxy.js"), "utf8");
  assert.doesNotMatch(proxy, /interview-invite/);
});
