import test from "node:test";
import assert from "node:assert/strict";
import {
  assertOwnedApplicationsPath,
  isOwnerStoragePath,
  sanitizeStoragePath,
} from "../lib/storage-path.js";
import {
  MAX_RECOMMENDATION_LETTERS,
  validateDocuments,
} from "../lib/application-validation.js";

const UID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER = "660e8400-e29b-41d4-a716-446655440000";

test("assertOwnedApplicationsPath accepts owner paths", () => {
  assert.equal(assertOwnedApplicationsPath(`${UID}/docs/a.pdf`, UID, "National ID"), null);
});

test("assertOwnedApplicationsPath rejects other-user paths", () => {
  const err = assertOwnedApplicationsPath(`${OTHER}/docs/a.pdf`, UID, "National ID");
  assert.match(err, /your account/i);
});

test("assertOwnedApplicationsPath rejects traversal", () => {
  assert.ok(assertOwnedApplicationsPath(`${UID}/../${OTHER}/x.pdf`, UID, "Doc"));
  assert.equal(sanitizeStoragePath(`${UID}/../x.pdf`).ok, false);
});

test("isOwnerStoragePath prefix-safe", () => {
  assert.equal(isOwnerStoragePath(`${UID}/a.pdf`, UID), true);
  assert.equal(isOwnerStoragePath(`${UID}evil/a.pdf`, UID), false);
});

test("validateDocuments rejects more than MAX recommendation letters", () => {
  const paths = Array.from(
    { length: MAX_RECOMMENDATION_LETTERS + 1 },
    (_, i) => `${UID}/rec-${i}.pdf`
  );
  const errors = validateDocuments({
    academic_transcript_url: `${UID}/t.pdf`,
    cv_personal_statement_url: `${UID}/cv.pdf`,
    student_id_path: `${UID}/id.pdf`,
    wassce_results_urls: [`${UID}/wassce-results/a.pdf`],
    recommendation_urls: paths,
    ksp_tiktok_follow_screenshot_path: `${UID}/tt.png`,
    ksp_linkedin_follow_screenshot_path: `${UID}/li.png`,
    ksp_instagram_follow_screenshot_path: `${UID}/ig.png`,
    photo_url: "https://example.com/avatars/x.jpg",
  });
  assert.ok(errors.recommendation_urls);
  assert.match(errors.recommendation_urls, /at most 5/i);
});
