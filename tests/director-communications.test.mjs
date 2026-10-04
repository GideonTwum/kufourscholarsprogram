import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_AUDIENCE_LABELS,
  COMMUNICATION_BATCH_SIZE,
  COMMUNICATION_TEMPLATES,
  applyPersonalization,
  buildPersonalizedEmail,
  buildRecipientDescriptors,
  dedupeCommunicationRecipients,
  deriveFirstName,
  filterClassifiedByAudience,
  isValidCommunicationAudience,
  isValidRecipientEmail,
  partitionRecipients,
  validateCommunicationContent,
} from "../lib/director-communications.js";
import { classifyDirectorApplications } from "../lib/director-application-workflow.js";
import { DIRECTOR_AUDIT_ACTIONS } from "../lib/audit/director-audit.js";

test("audiences are allowlisted and labeled", () => {
  for (const key of [
    "all_submitted",
    "pending",
    "stage_1_approved",
    "unassigned",
    "assigned",
    "assessed",
    "interview_panel",
    "interview_review_pending",
    "called_for_interview",
    "accepted",
    "rejected",
    "individual",
  ]) {
    assert.equal(isValidCommunicationAudience(key), true);
    assert.ok(COMMUNICATION_AUDIENCE_LABELS[key]);
  }
  assert.equal(isValidCommunicationAudience("approved"), false);
  assert.equal(isValidCommunicationAudience("draft"), false);
  assert.ok(COMMUNICATION_AUDIENCES.includes("assessed"));
});

test("filterClassifiedByAudience uses workflow classifier + pending/status semantics", () => {
  const apps = [
    { id: "1", status: "stage_1_submitted", user_id: "u1" },
    { id: "2", status: "stage_1_submitted", user_id: "u2" },
    { id: "3", status: "interview_review_pending", user_id: "u3" },
    { id: "4", status: "accepted", user_id: "u4" },
    { id: "5", status: "rejected", user_id: "u5" },
    { id: "6", status: "draft", user_id: "u6" },
  ];
  const assignmentMap = {
    "2": { assessor_id: "a1", hasAssessment: true },
  };
  // Draft should not appear in operational loads; if present, workflow null
  const classified = classifyDirectorApplications(apps, assignmentMap);

  assert.equal(filterClassifiedByAudience(classified, "all_submitted").length, 6);
  assert.ok(filterClassifiedByAudience(classified, "pending").every((r) => r.app.status !== "accepted" && r.app.status !== "rejected"));
  assert.equal(filterClassifiedByAudience(classified, "assessed").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "assessed")[0].app.id, "2");
  assert.equal(filterClassifiedByAudience(classified, "interview_panel").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "accepted").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "rejected").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "individual", "3").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "bogus").length, 0);
});

test("dedupe prefers user_id and avoids duplicate emails", () => {
  const rows = [
    { user_id: "u1", email: "a@example.com", application_id: "1" },
    { user_id: "u1", email: "a@example.com", application_id: "2" },
    { user_id: "u2", email: "b@example.com", application_id: "3" },
    { user_id: null, email: "b@example.com", application_id: "4" },
  ];
  const deduped = dedupeCommunicationRecipients(rows);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].application_id, "1");
  assert.equal(deduped[1].application_id, "3");
});

test("partitionRecipients excludes invalid emails", () => {
  const { sendable, excluded } = partitionRecipients([
    { email: "ok@example.com", application_id: "1" },
    { email: "", application_id: "2" },
    { email: "not-an-email", application_id: "3" },
  ]);
  assert.equal(sendable.length, 1);
  assert.equal(excluded.length, 2);
  assert.equal(isValidRecipientEmail("ok@example.com"), true);
  assert.equal(isValidRecipientEmail("bad"), false);
});

test("personalization allowlist only", () => {
  assert.equal(deriveFirstName("Ama Mensah"), "Ama");
  assert.equal(
    applyPersonalization("Hello {{first_name}} {{unknown}}", { first_name: "Ama" }),
    "Hello Ama {{unknown}}"
  );
  const email = buildPersonalizedEmail({
    subject: "Hi {{first_name}}",
    body: "Dear {{full_name}},\nWelcome.",
    fullName: "Ama Mensah",
  });
  assert.equal(email.subject, "Hi Ama");
  assert.match(email.text, /Dear Ama Mensah/);
  assert.match(email.html, /Dear Ama Mensah/);
  assert.doesNotMatch(email.html, /<script/);
  assert.match(email.html, /<br\/>/);
});

test("content validation bounds", () => {
  assert.ok(validateCommunicationContent({ subject: "", body: "x" }).subject);
  assert.ok(validateCommunicationContent({ subject: "x", body: "" }).body);
  assert.deepEqual(
    validateCommunicationContent({ subject: "Hello", body: "Body text" }),
    {}
  );
});

test("templates exist for required recruitment messages", () => {
  const ids = COMMUNICATION_TEMPLATES.map((t) => t.id);
  for (const id of [
    "application_update",
    "assessment_update",
    "shortlisted_interview",
    "interview_details",
    "accepted",
    "not_selected",
    "missing_information",
    "custom",
  ]) {
    assert.ok(ids.includes(id), id);
  }
});

test("batch size is capped for progressive delivery", () => {
  assert.ok(COMMUNICATION_BATCH_SIZE > 0);
  assert.ok(COMMUNICATION_BATCH_SIZE <= 25);
});

test("buildRecipientDescriptors maps classified rows", () => {
  const classified = [
    {
      workflow: "unassigned",
      app: {
        id: "app1",
        user_id: "u1",
        status: "stage_1_submitted",
        full_name: "Test User",
        university: "UG",
        profiles: { email: "t@example.com", full_name: "Test User" },
      },
    },
  ];
  const desc = buildRecipientDescriptors(classified);
  assert.equal(desc[0].email, "t@example.com");
  assert.equal(desc[0].workflow, "unassigned");
});

test("migration and wiring exist; announcements remain separate", () => {
  const mig = resolve("supabase/migrations/202609270001_director_communications.sql");
  assert.equal(existsSync(mig), true);
  const sql = readFileSync(mig, "utf8");
  assert.match(sql, /director_communications/);
  assert.match(sql, /director_communication_recipients/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql, /DROP TABLE/);

  assert.ok(DIRECTOR_AUDIT_ACTIONS.includes("communication.sent"));
  assert.ok(DIRECTOR_AUDIT_ACTIONS.includes("communication.completed"));

  const layout = readFileSync(resolve("app/(dashboard)/layout.js"), "utf8");
  assert.match(layout, /\/director\/communications/);

  const detail = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(detail, /Message Applicant/);
  assert.match(detail, /communications\?applicant=/);

  const sendRoute = readFileSync(
    resolve("app/api/director/communications/route.js"),
    "utf8"
  );
  assert.match(sendRoute, /confirm !== true/);
  assert.match(sendRoute, /Client-provided recipient lists are not allowed/);
  assert.match(sendRoute, /requireActiveDirector/);
  assert.match(sendRoute, /resolveCommunicationAudience/);
  assert.doesNotMatch(sendRoute, /body\.emails\.map/);

  const preview = readFileSync(
    resolve("app/api/director/communications/preview/route.js"),
    "utf8"
  );
  assert.match(preview, /requireActiveDirector/);
  assert.match(preview, /resolveCommunicationAudience/);

  // Announcements stay in-app (no email send in announcements API)
  const announcements = readFileSync(
    resolve("app/api/director/announcements/route.js"),
    "utf8"
  );
  assert.doesNotMatch(announcements, /sendKspEmail/);
});
