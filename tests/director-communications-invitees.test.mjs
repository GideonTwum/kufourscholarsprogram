import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  COMMUNICATION_AUDIENCE_HINTS,
  COMMUNICATION_AUDIENCE_LABELS,
  COMMUNICATION_INVITEE_AUDIENCES,
  buildInviteeRecipientDescriptors,
  buildRecipientDescriptors,
  dedupeCommunicationRecipients,
  filterClassifiedByAudience,
  finalizeCommunicationRecipients,
  isValidCommunicationAudience,
  resolveCommunicationAudience,
} from "../lib/director-communications.js";
import { classifyDirectorApplications } from "../lib/director-application-workflow.js";
import { UNIVERSITY_INVITEE_LABEL } from "../lib/director-interview-invitees.js";

test("University Special Invitees and All Interview Participants are allowlisted", () => {
  assert.equal(isValidCommunicationAudience("university_special_invitees"), true);
  assert.equal(isValidCommunicationAudience("all_interview_participants"), true);
  assert.equal(COMMUNICATION_AUDIENCE_LABELS.university_special_invitees, "University Special Invitees");
  assert.equal(COMMUNICATION_AUDIENCE_LABELS.all_interview_participants, "All Interview Participants");
  assert.deepEqual(COMMUNICATION_INVITEE_AUDIENCES, [
    "university_special_invitees",
    "all_interview_participants",
  ]);
  assert.match(COMMUNICATION_AUDIENCE_HINTS.called_for_interview, /Does not include university special invitees/i);
  assert.match(COMMUNICATION_AUDIENCE_HINTS.university_special_invitees, /does not publish batches/i);
  assert.match(COMMUNICATION_AUDIENCE_HINTS.all_interview_participants, /Deduplicates by email/i);
});

test("Called for Interview stays applicants-only and excludes shortlisted-unscheduled", () => {
  const apps = [
    { id: "a", status: "interview_review_pending", user_id: "u1", full_name: "Shortlisted", profiles: { email: "short@example.com" } },
    { id: "b", status: "called_for_interview", user_id: "u2", full_name: "Called", university: "UG", profiles: { email: "called@example.com" } },
    { id: "c", status: "interview", user_id: "u3", full_name: "Interviewed", profiles: { email: "done@example.com" } },
  ];
  const classified = classifyDirectorApplications(apps, {});
  const called = filterClassifiedByAudience(classified, "called_for_interview");
  assert.equal(called.length, 1);
  assert.equal(called[0].app.id, "b");
  const descriptors = buildRecipientDescriptors(called);
  assert.equal(descriptors[0].source_kind, "applicant");
  assert.equal(descriptors[0].email, "called@example.com");
  assert.equal(filterClassifiedByAudience(classified, "university_special_invitees").length, 0);
});

test("Invitee descriptors mark University Invitee and optional batch", () => {
  const descriptors = buildInviteeRecipientDescriptors(
    [
      {
        id: "inv-1",
        full_name: "Adaeze Okonkwo",
        university: "University of Oxford",
        email: "adaeze@oxford.example",
        interview_slot_id: "slot-1",
      },
      {
        id: "inv-2",
        full_name: "No Email",
        university: "MIT",
        email: "",
        interview_slot_id: null,
      },
    ],
    {
      "slot-1": {
        id: "slot-1",
        batch_name: "Batch 2",
        interview_date: "2026-11-17",
        interview_time: "09:00",
        end_time: "10:00",
      },
    }
  );
  assert.equal(descriptors[0].source_kind, "invitee");
  assert.equal(descriptors[0].source_label, UNIVERSITY_INVITEE_LABEL);
  assert.equal(descriptors[0].application_id, null);
  assert.equal(descriptors[0].invitee_id, "inv-1");
  assert.match(descriptors[0].assigned_batch_label, /Batch 2/);
  assert.equal(descriptors[1].assigned_batch_label, null);
  const finalized = finalizeCommunicationRecipients(descriptors);
  assert.equal(finalized.sendable.length, 1);
  assert.equal(finalized.excluded.length, 1);
  assert.equal(finalized.sendable[0].email, "adaeze@oxford.example");
});

test("All Interview Participants combines called applicants and invitees with email dedupe", () => {
  const applicants = buildRecipientDescriptors(
    classifyDirectorApplications(
      [
        {
          id: "app-1",
          status: "called_for_interview",
          user_id: "u1",
          full_name: "Ama Mensah",
          university: "UG",
          profiles: { email: "shared@example.com" },
        },
        {
          id: "app-2",
          status: "called_for_interview",
          user_id: "u2",
          full_name: "Kofi Boateng",
          university: "KNUST",
          profiles: { email: "kofi@example.com" },
        },
        {
          id: "app-3",
          status: "interview_review_pending",
          user_id: "u3",
          full_name: "Not Called",
          profiles: { email: "shortlist@example.com" },
        },
      ],
      {}
    ).filter((row) => row.app.status === "called_for_interview")
  );
  const invitees = buildInviteeRecipientDescriptors([
    {
      id: "inv-1",
      full_name: "Adaeze Okonkwo",
      university: "Oxford",
      email: "shared@example.com",
    },
    {
      id: "inv-2",
      full_name: "Jean Dupont",
      university: "Sorbonne",
      email: "jean@example.com",
    },
  ]);
  const combined = finalizeCommunicationRecipients([...applicants, ...invitees]);
  assert.equal(combined.sendable.length, 3);
  const emails = combined.sendable.map((r) => r.email).sort();
  assert.deepEqual(emails, ["jean@example.com", "kofi@example.com", "shared@example.com"]);
  assert.equal(
    combined.sendable.filter((r) => r.source_kind === "applicant").length +
      combined.sendable.filter((r) => r.source_kind === "invitee").length,
    3
  );
  assert.ok(!emails.includes("shortlist@example.com"));
});

function thenableQuery(result) {
  const chain = {
    select() {
      return chain;
    },
    neq() {
      return chain;
    },
    eq() {
      return chain;
    },
    in() {
      return chain;
    },
    order() {
      return chain;
    },
    range() {
      return Promise.resolve(result);
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

test("resolveCommunicationAudience loads invitees without mutating applications", async () => {
  const inviteeRows = [
    {
      id: "inv-1",
      full_name: "Adaeze Okonkwo",
      university: "Oxford",
      email: "adaeze@oxford.example",
      email_normalized: "adaeze@oxford.example",
      interview_slot_id: null,
      source_type: "university_invitee",
    },
  ];
  const apps = [
    {
      id: "app-1",
      status: "called_for_interview",
      user_id: "u1",
      full_name: "Ama Mensah",
      university: "UG",
      profiles: { email: "ama@example.com", full_name: "Ama Mensah" },
    },
    {
      id: "app-2",
      status: "interview_review_pending",
      user_id: "u2",
      full_name: "Shortlisted",
      profiles: { email: "short@example.com" },
    },
  ];

  function makeAdmin() {
    return {
      from(table) {
        if (table === "interview_special_invitees") {
          return thenableQuery({ data: inviteeRows, error: null });
        }
        if (table === "applications") {
          return thenableQuery({ data: apps, error: null });
        }
        if (table === "interview_slots") {
          return thenableQuery({ data: [], error: null });
        }
        if (table === "assessor_assignments" || table === "application_assessments") {
          return thenableQuery({ data: [], error: null });
        }
        return thenableQuery({ data: [], error: null });
      },
    };
  }

  const inviteeOnly = await resolveCommunicationAudience(
    makeAdmin(),
    "university_special_invitees"
  );
  assert.equal(inviteeOnly.ok, true);
  assert.equal(inviteeOnly.sendable.length, 1);
  assert.equal(inviteeOnly.sendable[0].source_kind, "invitee");
  assert.equal(inviteeOnly.mutates_applications, false);
  assert.equal(inviteeOnly.mutates_interview_assignments, false);

  const called = await resolveCommunicationAudience(makeAdmin(), "called_for_interview");
  assert.equal(called.ok, true);
  assert.equal(called.sendable.length, 1);
  assert.equal(called.sendable[0].email, "ama@example.com");
  assert.equal(called.sendable[0].source_kind, "applicant");

  const all = await resolveCommunicationAudience(makeAdmin(), "all_interview_participants");
  assert.equal(all.ok, true);
  assert.equal(all.sendable.length, 2);
  assert.equal(all.mutates_applications, false);
  assert.equal(all.mutates_interview_assignments, false);
});

test("communications UI and APIs expose invitee audiences without invitation publish side effects", () => {
  const ui = readFileSync(
    resolve("app/(dashboard)/director/communications/CommunicationsClient.jsx"),
    "utf8"
  );
  assert.match(ui, /COMMUNICATION_AUDIENCES/);
  assert.match(ui, /source_label/);
  assert.match(ui, /assigned_batch_label/);
  assert.match(ui, /Send to \{preview\?\.recipient_count \?\? 0\} Recipients/);

  const preview = readFileSync(resolve("app/api/director/communications/preview/route.js"), "utf8");
  assert.match(preview, /mutates_applications: false/);
  assert.match(preview, /mutates_interview_assignments: false/);
  assert.match(preview, /invitee_id/);
  assert.match(preview, /source_kind/);

  const create = readFileSync(resolve("app/api/director/communications/route.js"), "utf8");
  assert.match(create, /mutates_applications: false/);
  assert.match(create, /application_id: r\.application_id \|\| null/);
  assert.doesNotMatch(create, /applications\.update|interview_slots\.update|publish/);

  const publish = readFileSync(resolve("lib/director-interview-publish.js"), "utf8");
  assert.match(publish, /deliverInviteeInvitations|deliverBatchInvitations/);
});

test("dedupeCommunicationRecipients still collapses same-email applicant pairs", () => {
  const deduped = dedupeCommunicationRecipients([
    { user_id: "u1", email: "a@example.com", application_id: "1" },
    { user_id: null, email: "A@example.com", invitee_id: "i1" },
  ]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].application_id, "1");
});
