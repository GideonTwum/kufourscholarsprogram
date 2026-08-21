import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APPLICATIONS_BUCKET,
  APPLICANT_UPLOAD_USER_MESSAGE,
  buildApplicantStoragePath,
  isLikelyStorageAuthError,
  toApplicantUploadErrorMessage,
} from "../lib/applicant-storage-upload.js";
import { isOwnerStoragePath, sanitizeStoragePath } from "../lib/storage-path.js";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const STAGE1_FOLDERS = [
  "cv",
  "transcript",
  "student-id",
  "recommendation",
  "leadership",
  "social-evidence/tiktok",
  "social-evidence/linkedin",
  "social-evidence/instagram",
  "concept-note",
];

test("applicant storage paths use auth uid as first segment for every Stage 1 folder", () => {
  for (const folder of STAGE1_FOLDERS) {
    const path = buildApplicantStoragePath(USER_A, folder, folder.includes("social") ? "png" : "pdf");
    assert.equal(path.split("/")[0], USER_A);
    assert.ok(path.startsWith(`${USER_A}/${folder}/`));
    assert.equal(isOwnerStoragePath(path, USER_A), true);
    assert.equal(isOwnerStoragePath(path, USER_B), false);
    assert.equal(sanitizeStoragePath(path).ok, true);
  }
});

test("applicant cannot target another applicant namespace via path builder", () => {
  const own = buildApplicantStoragePath(USER_A, "transcript", "pdf");
  assert.equal(own.startsWith(`${USER_B}/`), false);
  assert.throws(() => buildApplicantStoragePath(`${USER_A}/${USER_B}`, "transcript", "pdf"));
  assert.throws(() => buildApplicantStoragePath(USER_A, "../other", "pdf"));
});

test("RLS-style storage errors map to applicant-safe message", () => {
  const raw = "new row violates row-level security policy";
  assert.equal(isLikelyStorageAuthError(raw), true);
  const prevErr = console.error;
  console.error = () => {};
  try {
    assert.equal(toApplicantUploadErrorMessage({ message: raw }), APPLICANT_UPLOAD_USER_MESSAGE);
    assert.doesNotMatch(APPLICANT_UPLOAD_USER_MESSAGE, /row-level security/i);
  } finally {
    console.error = prevErr;
  }
});

test("storage owner CRUD migration grants INSERT SELECT UPDATE DELETE for own folder only", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/202608220001_applications_storage_owner_crud.sql"),
    "utf8"
  );
  assert.match(sql, /Users can upload to own folder/);
  assert.match(sql, /Users can read own uploads/);
  assert.match(sql, /Users can update own uploads/);
  assert.match(sql, /Users can delete own uploads/);
  assert.match(sql, /FOR INSERT/);
  assert.match(sql, /FOR SELECT/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /FOR DELETE/);
  assert.match(sql, /TO authenticated/);
  assert.match(sql, /bucket_id = 'applications'/);
  assert.match(sql, /auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/);
  assert.match(sql, /public = false/);
  assert.doesNotMatch(sql, /WITH CHECK\s*\(\s*true\s*\)\s*;/i);
  assert.ok(!/CREATE POLICY[\s\S]*?WITH CHECK\s*\(\s*true\s*\)/i.test(sql));
  assert.doesNotMatch(sql, /service_role/);
});

test("Documents and ConceptNote use shared path builder, session auth, and safe errors", () => {
  const docs = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/Documents.jsx"),
    "utf8"
  );
  const concept = readFileSync(
    resolve("app/(applicant)/applicant/application/steps/ConceptNote.jsx"),
    "utf8"
  );
  for (const src of [docs, concept]) {
    assert.match(src, /buildApplicantStoragePath/);
    assert.match(src, /resolveAuthenticatedUploadUser/);
    assert.match(src, /toApplicantUploadErrorMessage/);
    assert.match(src, /APPLICATIONS_BUCKET/);
    assert.doesNotMatch(src, /error\.message \|\| "Upload failed\."/);
  }
  assert.match(docs, /"cv"/);
  assert.match(docs, /"transcript"/);
  assert.match(docs, /"student-id"/);
  assert.match(docs, /"recommendation"/);
  assert.match(docs, /"leadership"/);
  assert.match(docs, /social-evidence\/tiktok/);
  assert.match(docs, /social-evidence\/linkedin/);
  assert.match(docs, /social-evidence\/instagram/);
  assert.match(concept, /concept-note/);
  assert.equal(APPLICATIONS_BUCKET, "applications");
});

test("historical applications policies lacked UPDATE/DELETE (regression baseline)", () => {
  const base = readFileSync(resolve("supabase-migration-applications.sql"), "utf8");
  assert.match(base, /Users can upload to own folder/);
  assert.match(base, /Users can read own uploads/);
  assert.doesNotMatch(base, /Users can update own uploads/);
  assert.doesNotMatch(base, /Users can delete own uploads/);
});
