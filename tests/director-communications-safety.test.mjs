import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_AUDIENCE_LABELS,
  COMMUNICATION_AUDIENCE_HINTS,
  COMMUNICATION_APPLICATION_SELECT,
  COMMUNICATION_BATCH_SIZE,
  SENDING_CLAIM_STALE_MS,
  applyPersonalization,
  buildPersonalizedEmail,
  buildRecipientDescriptors,
  deriveFirstName,
  filterClassifiedByAudience,
  isValidCommunicationAudience,
  shouldAttemptDelivery,
  continueUsesPersistedSnapshotOnly,
  validateCommunicationContent,
} from "../lib/director-communications.js";
import { DIRECTOR_PENDING_STATUSES } from "../lib/director-application-scope.js";
import { classifyDirectorApplications } from "../lib/director-application-workflow.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

test("pending audience matches DIRECTOR_PENDING_STATUSES exactly", () => {
  assert.deepEqual(DIRECTOR_PENDING_STATUSES, [
    "stage_1_submitted",
    "pending",
    "review_pending",
    "stage_1_approved",
    "stage_2_submitted",
    "stage_2_review_pending",
    "stage_2_approved",
    "interview_review_pending",
    "called_for_interview",
    "interview",
  ]);

  const statuses = [
    "stage_1_submitted",
    "review_pending",
    "stage_1_approved",
    "stage_2_submitted",
    "stage_2_review_pending",
    "stage_2_approved",
    "accepted",
    "rejected",
    "draft",
  ];
  const apps = statuses.map((status, i) => ({ id: String(i), status, user_id: `u${i}` }));
  const classified = classifyDirectorApplications(apps, {});
  const pending = filterClassifiedByAudience(classified, "pending");
  const pendingStatuses = pending.map((r) => r.app.status);

  for (const s of [
    "stage_1_submitted",
    "review_pending",
    "stage_1_approved",
    "stage_2_submitted",
    "stage_2_review_pending",
    "stage_2_approved",
  ]) {
    assert.ok(pendingStatuses.includes(s), `${s} must be included in pending`);
  }
  assert.ok(!pendingStatuses.includes("accepted"));
  assert.ok(!pendingStatuses.includes("rejected"));
  assert.ok(!pendingStatuses.includes("draft"));
});

test("accepted and rejected audiences are exact status only", () => {
  const apps = [
    { id: "1", status: "accepted", user_id: "u1" },
    { id: "2", status: "rejected", user_id: "u2" },
    { id: "3", status: "interview", user_id: "u3" },
    { id: "4", status: "stage_2_approved", user_id: "u4" },
  ];
  // Assessed workflow must not put someone in accepted
  const assignmentMap = {
    "4": { assessor_id: "a1", hasAssessment: true },
  };
  const classified = classifyDirectorApplications(apps, assignmentMap);
  assert.equal(filterClassifiedByAudience(classified, "accepted").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "accepted")[0].app.id, "1");
  assert.equal(filterClassifiedByAudience(classified, "rejected").length, 1);
  assert.equal(filterClassifiedByAudience(classified, "rejected")[0].app.id, "2");
  assert.equal(filterClassifiedByAudience(classified, "assessed")[0]?.app.id, "4");
});

test("interview audiences: pipeline vs shortlisted vs called", () => {
  const apps = [
    { id: "a", status: "interview_review_pending", user_id: "u1" },
    { id: "b", status: "called_for_interview", user_id: "u2" },
    { id: "c", status: "interview", user_id: "u3" },
    { id: "d", status: "stage_2_approved", user_id: "u4" },
  ];
  const classified = classifyDirectorApplications(apps, {});

  const pipeline = filterClassifiedByAudience(classified, "interview_panel");
  assert.deepEqual(
    pipeline.map((r) => r.app.status).sort(),
    ["called_for_interview", "interview", "interview_review_pending"]
  );

  const shortlisted = filterClassifiedByAudience(classified, "interview_review_pending");
  assert.equal(shortlisted.length, 1);
  assert.equal(shortlisted[0].app.status, "interview_review_pending");

  const called = filterClassifiedByAudience(classified, "called_for_interview");
  assert.equal(called.length, 1);
  assert.equal(called[0].app.status, "called_for_interview");

  assert.equal(COMMUNICATION_AUDIENCE_LABELS.interview_panel, "Interview Pipeline");
  assert.match(COMMUNICATION_AUDIENCE_HINTS.interview_panel, /not for/i);
  assert.ok(isValidCommunicationAudience("interview_review_pending"));
  assert.ok(isValidCommunicationAudience("called_for_interview"));
});

test("personalization never yields Dear , or Dear undefined,", () => {
  assert.equal(deriveFirstName(""), "Applicant");
  assert.equal(deriveFirstName("   "), "Applicant");
  assert.equal(deriveFirstName(null), "Applicant");
  assert.equal(deriveFirstName("Ama"), "Ama");
  assert.equal(deriveFirstName("Ama Mensah"), "Ama");

  for (const name of ["", "   ", null, undefined]) {
    const email = buildPersonalizedEmail({
      subject: "Hi {{first_name}}",
      body: "Dear {{first_name}},\nHello {{full_name}}.",
      fullName: name,
    });
    assert.equal(email.subject, "Hi Applicant");
    assert.match(email.text, /^Dear Applicant,/);
    assert.doesNotMatch(email.text, /Dear\s*,/);
    assert.doesNotMatch(email.text, /undefined/);
  }

  const htmlish = buildPersonalizedEmail({
    subject: "X",
    body: "Hello {{full_name}}",
    fullName: '<script>alert(1)</script> Ama',
  });
  assert.match(htmlish.html, /&lt;script&gt;/);
  assert.doesNotMatch(htmlish.html, /<script>/);
  assert.equal(
    applyPersonalization("{{evil}} {{first_name}}", { first_name: "Ama", evil: "nope" }),
    "{{evil}} Ama"
  );
});

test("delivery attempt rules: pending only; sent/failed never auto-retried", () => {
  assert.equal(shouldAttemptDelivery("pending"), true);
  assert.equal(shouldAttemptDelivery("sending"), false);
  assert.equal(shouldAttemptDelivery("sent"), false);
  assert.equal(shouldAttemptDelivery("failed"), false);
  assert.equal(shouldAttemptDelivery("skipped"), false);
  assert.equal(continueUsesPersistedSnapshotOnly(), true);
  assert.ok(SENDING_CLAIM_STALE_MS >= 60_000);
});

test("atomic claim pattern: second claim of same pending id fails", async () => {
  // Mirrors claimRecipientForSend without importing the send module (Resend/@ alias).
  const store = {
    id: "r1",
    delivery_status: "pending",
    email: "a@example.com",
    full_name_snapshot: "Ama",
    application_id: "app1",
  };

  async function claim(recipientId) {
    if (store.id !== recipientId || store.delivery_status !== "pending") return null;
    store.delivery_status = "sending";
    store.claimed_at = new Date().toISOString();
    return {
      id: store.id,
      email: store.email,
      full_name_snapshot: store.full_name_snapshot,
      application_id: store.application_id,
    };
  }

  const first = await claim("r1");
  const second = await claim("r1");
  assert.ok(first);
  assert.equal(first.id, "r1");
  assert.equal(second, null);
  assert.equal(store.delivery_status, "sending");
});

test("snapshot immutability: continue never re-resolves audience (code contract)", () => {
  const continueRoute = readFileSync(
    resolve("app/api/director/communications/[id]/continue/route.js"),
    "utf8"
  );
  assert.match(continueRoute, /processCommunicationBatch/);
  assert.doesNotMatch(continueRoute, /resolveCommunicationAudience/);

  const sendLib = readFileSync(resolve("lib/director-communications-send.js"), "utf8");
  assert.match(sendLib, /claimRecipientForSend/);
  assert.match(sendLib, /delivery_status", "pending"/);
  assert.match(sendLib, /sending/);

  const createRoute = readFileSync(resolve("app/api/director/communications/route.js"), "utf8");
  // Recipients persisted before first batch
  const insertIdx = createRoute.indexOf('from("director_communication_recipients").insert');
  const batchIdx = createRoute.indexOf("processCommunicationBatch(admin, created.id");
  assert.ok(insertIdx > 0, "must insert recipient snapshot rows");
  assert.ok(batchIdx > insertIdx, "recipients must be inserted before first send batch");
});

test("large campaign batch math without sending", () => {
  const recipients = 564;
  const batches = Math.ceil(recipients / COMMUNICATION_BATCH_SIZE);
  assert.equal(COMMUNICATION_BATCH_SIZE, 15);
  assert.equal(batches, 38);
});

test("zero recipient and validation edges", () => {
  assert.deepEqual(filterClassifiedByAudience([], "assessed"), []);
  assert.ok(validateCommunicationContent({ subject: "", body: "x" }).subject);
  assert.ok(COMMUNICATION_AUDIENCES.includes("interview_review_pending"));
});

test("migration includes sending claim + RLS; resume UI present", () => {
  const mig = resolve("supabase/migrations/202609270001_director_communications.sql");
  assert.equal(existsSync(mig), true);
  const sql = readFileSync(mig, "utf8");
  assert.match(sql, /'sending'/);
  assert.match(sql, /claimed_at/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /role = 'director'/);
  assert.doesNotMatch(sql, /FOR INSERT/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM/);

  const ui = readFileSync(
    resolve("app/(dashboard)/director/communications/CommunicationsClient.jsx"),
    "utf8"
  );
  assert.match(ui, /Resume Sending/);
  assert.match(ui, /resumeCampaign/);
  assert.match(ui, /already-delivered applicants are skipped/i);
});

test("audience select uses profiles.email — never applications.email column", () => {
  assert.match(COMMUNICATION_APPLICATION_SELECT, /profiles!applications_user_id_fkey\(full_name, email\)/);
  // Must not request a top-level applications.email column (does not exist in schema)
  assert.doesNotMatch(COMMUNICATION_APPLICATION_SELECT, /university, email,/);
  assert.doesNotMatch(COMMUNICATION_APPLICATION_SELECT, /,\s*email,/);
  assert.doesNotMatch(COMMUNICATION_APPLICATION_SELECT, /,\s*email$/);

  const desc = buildRecipientDescriptors([
    {
      workflow: "assessed",
      app: {
        id: "a1",
        user_id: "u1",
        status: "stage_1_submitted",
        full_name: "Ama Mensah",
        university: "UG",
        profiles: { email: "ama@example.com", full_name: "Ama Mensah" },
      },
    },
  ]);
  assert.equal(desc[0].email, "ama@example.com");
});

test("audit payloads avoid full body and recipient lists", () => {
  const route = readFileSync(resolve("app/api/director/communications/route.js"), "utf8");
  assert.match(route, /recipient_count/);
  assert.match(route, /subject/);
  assert.doesNotMatch(route, /newValue:[\s\S]{0,120}body:/);
  assert.doesNotMatch(route, /newValue:[\s\S]{0,200}emails:/);
});
