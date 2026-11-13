import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_COMM_ATTACHMENT_MAX_BYTES,
  DIRECTOR_COMM_ATTACHMENT_MAX_COUNT,
  DIRECTOR_COMM_ATTACHMENT_MAX_TOTAL_BYTES,
  attachmentContentLooksValid,
  buildDirectorCommStoragePath,
  buildResendAttachmentsFromContent,
  buildResendAttachmentsFromSignedUrls,
  formatAttachmentBytes,
  sanitizeAttachmentFilename,
  summarizeAttachmentDescriptors,
  validateDirectorCommunicationAttachment,
  validateDirectorCommunicationAttachments,
} from "../lib/director-communication-attachments.js";

const routeSource = readFileSync(resolve("app/api/director/communications/route.js"), "utf8");
const sendSource = readFileSync(resolve("lib/director-communications-send.js"), "utf8");
const emailSendSource = readFileSync(resolve("lib/email/send.js"), "utf8");
const notifySource = readFileSync(resolve("lib/email/notify.js"), "utf8");
const edgeSource = readFileSync(resolve("supabase/functions/send-email/index.ts"), "utf8");
const clientSource = readFileSync(
  resolve("app/(dashboard)/director/communications/CommunicationsClient.jsx"),
  "utf8"
);
const migrationSource = readFileSync(
  resolve("supabase/migrations/202611130001_director_communication_attachments.sql"),
  "utf8"
);

function pdfBytes(size = 64) {
  const buf = Buffer.alloc(size, 0x20);
  Buffer.from("%PDF-1.4").copy(buf, 0);
  return buf;
}

test("valid PDF attachment is accepted", () => {
  const bytes = pdfBytes(1200);
  const result = validateDirectorCommunicationAttachment(
    { name: "Schedule.pdf", type: "application/pdf", size: bytes.length },
    bytes
  );
  assert.equal(result.ok, true);
  assert.equal(result.filename, "Schedule.pdf");
  assert.equal(result.contentType, "application/pdf");
});

test("multiple attachments validate total size and count", () => {
  const files = [
    { file: { name: "a.pdf", type: "application/pdf", size: 1000 }, bytes: pdfBytes(1000) },
    { file: { name: "b.pdf", type: "application/pdf", size: 1000 }, bytes: pdfBytes(1000) },
  ];
  const ok = validateDirectorCommunicationAttachments(files);
  assert.equal(ok.ok, true);
  assert.equal(ok.attachments.length, 2);

  const tooMany = Array.from({ length: DIRECTOR_COMM_ATTACHMENT_MAX_COUNT + 1 }, (_, i) => ({
    file: { name: `f${i}.pdf`, type: "application/pdf", size: 10 },
    bytes: pdfBytes(10),
  }));
  const many = validateDirectorCommunicationAttachments(tooMany);
  assert.equal(many.ok, false);
  assert.equal(many.code, "too_many_files");
});

test("unsupported and dangerous types are rejected", () => {
  assert.equal(
    validateDirectorCommunicationAttachment({ name: "payload.exe", size: 10 }, Buffer.alloc(10)).code,
    "dangerous_type"
  );
  assert.equal(
    validateDirectorCommunicationAttachment({ name: "notes.html", size: 10 }, Buffer.from("hi")).code,
    "dangerous_type"
  );
  assert.equal(
    validateDirectorCommunicationAttachment({ name: "notes.xyz", size: 10 }, Buffer.from("hi")).code,
    "unsupported_type"
  );
  const video = validateDirectorCommunicationAttachment(
    { name: "clip.mp4", type: "video/mp4", size: 1000 },
    Buffer.alloc(1000)
  );
  assert.equal(video.ok, false);
  assert.equal(video.code, "video_not_attached");
  assert.match(video.error, /secure link/i);
});

test("oversized files and totals are rejected", () => {
  const huge = validateDirectorCommunicationAttachment({
    name: "big.pdf",
    type: "application/pdf",
    size: DIRECTOR_COMM_ATTACHMENT_MAX_BYTES + 1,
  });
  assert.equal(huge.ok, false);
  assert.equal(huge.code, "file_too_large");

  const perFile = Math.floor(DIRECTOR_COMM_ATTACHMENT_MAX_BYTES * 0.9);
  const overTotal = validateDirectorCommunicationAttachments([
    {
      file: {
        name: "one.pdf",
        type: "application/pdf",
        size: perFile,
      },
    },
    {
      file: { name: "two.pdf", type: "application/pdf", size: perFile },
    },
  ]);
  assert.equal(overTotal.ok, false);
  assert.equal(overTotal.code, "total_too_large");
});

test("filenames are sanitized and content sniffing catches mismatches", () => {
  assert.equal(sanitizeAttachmentFilename("../../evil.pdf"), "evil.pdf");
  assert.equal(sanitizeAttachmentFilename("a<b>.pdf"), "a_b_.pdf");
  assert.equal(attachmentContentLooksValid("pdf", Buffer.from("%PDF-1.7....")), true);
  assert.equal(attachmentContentLooksValid("pdf", Buffer.from("not-a-pdf")), false);
  assert.equal(
    validateDirectorCommunicationAttachment(
      { name: "fake.pdf", type: "application/pdf", size: 12 },
      Buffer.from("not-a-pdf!!!")
    ).code,
    "content_mismatch"
  );
});

test("provider payloads support signed URL path and base64 content without omitting attachments", () => {
  const remote = buildResendAttachmentsFromSignedUrls([
    {
      filename: "Agenda.pdf",
      signed_url: "https://example.test/signed/agenda.pdf",
      content_type: "application/pdf",
    },
  ]);
  assert.deepEqual(remote, [
    {
      path: "https://example.test/signed/agenda.pdf",
      filename: "Agenda.pdf",
      content_type: "application/pdf",
    },
  ]);

  const local = buildResendAttachmentsFromContent([
    { filename: "note.txt", content_type: "text/plain", bytes: Buffer.from("hello") },
  ]);
  assert.equal(local[0].filename, "note.txt");
  assert.equal(local[0].content, Buffer.from("hello").toString("base64"));
  assert.match(notifySource, /payload\.attachments = attachments/);
  assert.match(emailSendSource, /attachments/);
  assert.match(edgeSource, /emailPayload\.attachments/);
  assert.match(sendSource, /loadResendAttachmentsForCommunication/);
  assert.match(sendSource, /attachments: resendAttachments/);
});

test("emails with no attachments keep working and bulk path avoids re-uploading bytes per recipient", () => {
  assert.deepEqual(buildResendAttachmentsFromSignedUrls([]), []);
  assert.equal(summarizeAttachmentDescriptors([]).count, 0);
  assert.match(sendSource, /resendAttachments\.length > 0 \? resendAttachments : null/);
  assert.match(routeSource, /multipart\/form-data/);
  assert.match(routeSource, /storeDirectorCommunicationAttachments/);
  assert.match(buildDirectorCommStoragePath("dir", "comm", "att", "File.pdf"), /dir\/comm\/att-File\.pdf/);
  assert.match(migrationSource, /director-communications/);
  assert.match(migrationSource, /attachments jsonb/);
  assert.match(migrationSource, /public = false/);
});

test("UI supports attach/remove, preview, confirmation, and double-submit guard", () => {
  assert.match(clientSource, /Attach Files/);
  assert.match(clientSource, /removeAttachment/);
  assert.match(clientSource, /attachments\.map/);
  assert.match(clientSource, /Total attachment size/);
  assert.match(clientSource, /FormData/);
  assert.match(clientSource, /if \(sending\) return/);
  assert.match(clientSource, /secure link/);
  assert.match(clientSource, /Attachments \(/);
});

test("authorization and duplicate-send protections remain on the communications route", () => {
  assert.match(routeSource, /requireActiveDirector\(\)/);
  assert.match(routeSource, /confirm !== true/);
  assert.match(routeSource, /Client-provided recipient lists are not allowed/);
  assert.match(routeSource, /idempotency_key/);
  assert.match(sendSource, /claimRecipientForSend/);
  assert.match(sendSource, /delivery_status", "pending"/);
  assert.equal(formatAttachmentBytes(2048), "2.0 KB");
  assert.ok(DIRECTOR_COMM_ATTACHMENT_MAX_BYTES < 40 * 1024 * 1024);
});
