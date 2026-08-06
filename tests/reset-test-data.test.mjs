import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = resolve("scripts/reset-test-data.mjs");
const DOCS = resolve("docs/TEST-DATA-RESET.md");
const VERIFY = resolve("docs/VERIFY-EMPTY-TEST-DATABASE.sql");

test("reset-test-data script and docs exist", () => {
  assert.equal(existsSync(SCRIPT), true);
  assert.equal(existsSync(DOCS), true);
  assert.equal(existsSync(VERIFY), true);
});

test("reset script defaults to dry-run and requires confirmations", () => {
  const src = readFileSync(SCRIPT, "utf8");
  assert.match(src, /RESET_KSP_TEST_DATA/);
  assert.match(src, /PRODUCTION_RESET_CONFIRMATION/);
  assert.match(src, /I_HAVE_BACKED_UP_KSP_PRODUCTION/);
  assert.match(src, /PRESERVE_DIRECTOR_EMAIL/);
  assert.match(src, /--execute/);
  assert.match(src, /dryRun/);
  assert.match(src, /deleteUser/);
  assert.doesNotMatch(src, /TRUNCATE/i);
  assert.doesNotMatch(src, /DROP TABLE/i);
  assert.doesNotMatch(src, /sendKspEmail|resetPasswordForEmail|inviteUserByEmail/);
  assert.match(src, /site_settings/);
  assert.match(src, /news_articles/);
  assert.match(src, /role !== \"director\"/);
});

test("package.json exposes reset:test-data script", () => {
  const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  assert.equal(pkg.scripts["reset:test-data"], "node scripts/reset-test-data.mjs");
});

test("docs warn about backup and production confirmation", () => {
  const docs = readFileSync(DOCS, "utf8");
  assert.match(docs, /Backup first/);
  assert.match(docs, /PRODUCTION_RESET_CONFIRMATION/);
  assert.match(docs, /--dry-run/);
  assert.match(docs, /--execute/);
});
