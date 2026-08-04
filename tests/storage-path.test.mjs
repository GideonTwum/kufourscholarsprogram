import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeStoragePath } from "../lib/storage-path.js";

test("rejects empty and absolute paths", () => {
  assert.equal(sanitizeStoragePath("").ok, false);
  assert.equal(sanitizeStoragePath("/a/b").ok, false);
  assert.equal(sanitizeStoragePath("https://x/y").ok, false);
});

test("accepts normal applicant object paths", () => {
  const r = sanitizeStoragePath("550e8400-e29b-41d4-a716-446655440000/transcript.pdf");
  assert.equal(r.ok, true);
  assert.equal(r.path, "550e8400-e29b-41d4-a716-446655440000/transcript.pdf");
});

test("collapses duplicate slashes without allowing traversal", () => {
  const r = sanitizeStoragePath("user12345/docs//file.pdf");
  assert.equal(r.ok, true);
  assert.equal(r.path, "user12345/docs/file.pdf");
});
