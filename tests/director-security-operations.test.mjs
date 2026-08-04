import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { scrubAuditPayload } from "../lib/audit/director-audit.js";
import {
  ANNOUNCEMENT_AUDIENCES,
  isValidAnnouncementAudience,
} from "../lib/announcement-audiences.js";

test("audit scrubber redacts secret-like keys", () => {
  const scrubbed = scrubAuditPayload({
    email: "a@ex.com",
    temporary_password: "SuperSecret123!",
    nested: { access_token: "tok", ok: true },
  });
  assert.equal(scrubbed.email, "a@ex.com");
  assert.equal(scrubbed.temporary_password, "[redacted]");
  assert.equal(scrubbed.nested.access_token, "[redacted]");
  assert.equal(scrubbed.nested.ok, true);
});

test("requireActiveDirector is used for privileged director paths", () => {
  const files = [
    "app/api/applications/[id]/update-status/route.js",
    "app/api/director/dashboard-metrics/route.js",
    "app/api/director/settings/route.js",
    "app/api/director/audit-log/route.js",
    "app/api/director/announcements/route.js",
    "app/api/interview-slots/route.js",
    "app/api/director/assessors/create/route.js",
  ];
  for (const f of files) {
    const src = readFileSync(resolve(f), "utf8");
    assert.match(src, /requireActiveDirector/, f);
  }
});

test("public director signup remains disabled and login has no create-account CTA", () => {
  const signupApi = readFileSync(resolve("app/api/director/signup/route.js"), "utf8");
  assert.match(signupApi, /403|SIGNUP_DISABLED/);

  const login = readFileSync(resolve("app/(auth)/director-login/page.js"), "utf8");
  assert.doesNotMatch(login, /New director\? Create an account/i);
  assert.match(login, /no public signup/i);

  const footer = readFileSync(resolve("components/landing/Footer.jsx"), "utf8");
  assert.doesNotMatch(footer, /director\/signup/);
  assert.match(footer, /director-login/);
});

test("announcement audiences are canonical launch values", () => {
  assert.ok(ANNOUNCEMENT_AUDIENCES.includes("all_applicants"));
  assert.ok(ANNOUNCEMENT_AUDIENCES.includes("called_for_interview"));
  assert.equal(isValidAnnouncementAudience("pending"), false);
  assert.equal(isValidAnnouncementAudience("under_review"), false);
  assert.equal(isValidAnnouncementAudience("shortlisted"), false);
  assert.equal(isValidAnnouncementAudience("all_applicants"), true);
});

test("director ops migration and manage script exist", () => {
  assert.equal(
    existsSync(resolve("supabase/migrations/202608040002_director_security_operations.sql")),
    true
  );
  assert.equal(existsSync(resolve("scripts/manage-director-user.mjs")), true);
  assert.equal(existsSync(resolve("docs/DIRECTOR-OPERATIONS-VERIFY.sql")), true);
  assert.equal(existsSync(resolve("app/(dashboard)/director/audit-log/page.js")), true);

  const sql = readFileSync(
    resolve("supabase/migrations/202608040002_director_security_operations.sql"),
    "utf8"
  );
  assert.match(sql, /director_audit_events/);
  assert.match(sql, /interview_slots_status_check|status IN \('scheduled'/);
  assert.doesNotMatch(sql, /FOR UPDATE|FOR DELETE/);
});

test("settings API allowlists fields only", () => {
  const src = readFileSync(resolve("app/api/director/settings/route.js"), "utf8");
  assert.match(src, /applications_open/);
  assert.match(src, /application_deadline/);
  assert.match(src, /ALLOWED_KEYS/);
  assert.match(src, /recordDirectorAudit/);
});

test("dashboard no longer labeled Administrator", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/page.js"), "utf8");
  assert.match(page, /Director Dashboard/);
  assert.doesNotMatch(page, /Administrator Dashboard/);
});

test("proxy blocks inactive directors", () => {
  const proxy = readFileSync(resolve("proxy.js"), "utf8");
  assert.match(proxy, /\/director.*is_active === false|isDirectorRole\(role\) && profile\?\.is_active === false/);
});
