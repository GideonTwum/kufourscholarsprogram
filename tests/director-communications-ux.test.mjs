import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ui = readFileSync(
  resolve("app/(dashboard)/director/communications/CommunicationsClient.jsx"),
  "utf8"
);

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `missing end marker after ${startMarker}`);
  return source.slice(start, end);
}

test("individual confirmation shows applicant identity without bulk instructions", () => {
  const individualBlock = extractBetween(
    ui,
    "{isIndividualConfirm ? (",
    ") : ("
  );

  assert.match(individualBlock, /Send this email\?/);
  assert.match(individualBlock, /You&apos;re about to send an email to:/);
  assert.match(individualBlock, /selectedApplicant\?\.full_name/);
  assert.match(individualBlock, /selectedApplicant\?\.email/);
  assert.match(individualBlock, /selectedApplicant\?\.university/);
  assert.match(individualBlock, />Subject</);
  assert.match(individualBlock, /Send Email/);
  assert.match(individualBlock, /Cancel/);

  assert.doesNotMatch(individualBlock, /batches of 15/);
  assert.doesNotMatch(individualBlock, /batch size/i);
  assert.doesNotMatch(individualBlock, /Keep this page open/);
  assert.doesNotMatch(individualBlock, /Continue Sending|Resume Sending/);
  assert.doesNotMatch(individualBlock, /History/);
  assert.doesNotMatch(individualBlock, /application_id|user_id|UUID/i);
});

test("bulk confirmation shows count, private delivery, and concise interruption guidance", () => {
  // Bulk branch is the else of isIndividualConfirm inside confirmOpen
  const confirmSection = extractBetween(ui, "{confirmOpen ? (", "</div>\n      ) : null}");
  const bulkStart = confirmSection.indexOf(") : (");
  assert.ok(bulkStart > 0);
  const bulkBlock = confirmSection.slice(bulkStart);

  assert.match(bulkBlock, /Send to \{preview\?\.recipient_count/);
  assert.match(bulkBlock, /Each applicant will receive a separate, private email\./);
  assert.match(bulkBlock, />Recipients</);
  assert.match(bulkBlock, />Subject</);
  assert.match(
    bulkBlock,
    /Emails are sent in small batches\.\s*Keep this page open while sending\.\s*If sending is\s*interrupted, you can continue from History\./
  );
  assert.match(bulkBlock, /Send to \{preview\?\.recipient_count \?\? 0\} Applicants/);

  assert.doesNotMatch(bulkBlock, /batches of 15/);
  assert.doesNotMatch(bulkBlock, /batch size\s*=\s*15/i);
  assert.doesNotMatch(bulkBlock, /COMMUNICATION_BATCH_SIZE/);
});

test("send still uses canonical application_id; no UUID display in confirm copy", () => {
  assert.match(
    ui,
    /application_id: audience === "individual" \? applicationId/
  );
  assert.match(ui, /isIndividualConfirm/);
  assert.match(ui, /selectedApplicant\?\.full_name/);

  const confirmSection = extractBetween(ui, "{confirmOpen ? (", "</div>\n      ) : null}");
  assert.doesNotMatch(confirmSection, /application_id/);
  assert.doesNotMatch(confirmSection, /user_id/);
  assert.doesNotMatch(confirmSection, /\bUUID\b/i);
});

test("history and progress use Director-friendly terminology", () => {
  assert.match(ui, /Email History/);
  assert.match(ui, /Continue Sending/);
  assert.match(ui, /This email was interrupted before all recipients were processed\./);
  assert.match(ui, /Sending emails\.\.\./);
  assert.match(ui, /Email sent successfully/);
  assert.match(ui, /Send Another Email/);
  assert.match(ui, /View History/);
  assert.match(ui, /Who are you emailing\?/);
  assert.match(ui, /What do you want to send\?/);

  assert.doesNotMatch(ui, /Resume Sending/);
  assert.doesNotMatch(ui, /batches of 15/);
  assert.doesNotMatch(ui, /claimed_at|stale claim|batch cursor/i);
});
