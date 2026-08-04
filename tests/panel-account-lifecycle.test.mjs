import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isProfileActive,
  deletionBlockReason,
  deactivateProfilePayload,
  reactivateProfilePayload,
  evaluatorDisplayName,
  AUTH_BAN_LONG,
  AUTH_BAN_NONE,
} from "../lib/staff-lifecycle.js";

test("isProfileActive treats missing/true as active and false as inactive", () => {
  assert.equal(isProfileActive(null), false);
  assert.equal(isProfileActive({ is_active: true }), true);
  assert.equal(isProfileActive({ is_active: undefined }), true);
  assert.equal(isProfileActive({ is_active: false }), false);
});

test("deletion blocked when evaluation history exists", () => {
  const msg = deletionBlockReason({ evaluationCount: 2, hasAssignments: false });
  assert.match(msg, /evaluation history/i);
  assert.match(msg, /Deactivate/i);
});

test("deletion blocked when assignments exist", () => {
  const msg = deletionBlockReason({ evaluationCount: 0, hasAssignments: true });
  assert.match(msg, /assignment/i);
});

test("unused panel member may be permanently deleted", () => {
  assert.equal(deletionBlockReason({ evaluationCount: 0, hasAssignments: false }), null);
});

test("deactivate/reactivate payloads preserve role and clear/set lifecycle fields", () => {
  const directorId = "11111111-1111-1111-1111-111111111111";
  const off = deactivateProfilePayload(directorId);
  assert.equal(off.is_active, false);
  assert.equal(off.deactivated_by, directorId);
  assert.ok(off.deactivated_at);

  const on = reactivateProfilePayload();
  assert.equal(on.is_active, true);
  assert.equal(on.deactivated_at, null);
  assert.equal(on.deactivated_by, null);
});

test("evaluatorDisplayName prefers immutable snapshots", () => {
  assert.equal(
    evaluatorDisplayName(
      { evaluator_name_snapshot: "Dr. Ada", evaluator_email_snapshot: "ada@ex.com" },
      { full_name: "Live Name", email: "live@ex.com" }
    ),
    "Dr. Ada"
  );
  assert.equal(
    evaluatorDisplayName({}, { full_name: "Live Name" }),
    "Live Name"
  );
  assert.equal(evaluatorDisplayName({}, null), "Panel Member");
});

test("auth ban constants for Admin API", () => {
  assert.equal(AUTH_BAN_NONE, "none");
  assert.ok(AUTH_BAN_LONG.length > 0);
});

test("director panel lifecycle API routes exist", () => {
  assert.equal(existsSync(resolve("app/api/director/panel/[id]/route.js")), true);
  assert.equal(existsSync(resolve("app/api/director/panel/accounts/route.js")), true);
  assert.equal(existsSync(resolve("supabase/migrations/202608030003_panel_account_lifecycle.sql")), true);
});

test("lifecycle route enforces director gate and panel-only targets", () => {
  const src = readFileSync(resolve("app/api/director/panel/[id]/route.js"), "utf8");
  assert.match(src, /requireDirectorUser/);
  assert.match(src, /profile\.role !== "panel"/);
  assert.match(src, /status: 409/);
  assert.match(src, /deleteUser/);
  assert.match(src, /ban_duration/);
  assert.match(src, /You cannot delete your own account/);
});

test("panel APIs and signed URLs require active panel", () => {
  const list = readFileSync(resolve("app/api/panel/applications/route.js"), "utf8");
  const detail = readFileSync(resolve("app/api/panel/applications/[id]/route.js"), "utf8");
  const signed = readFileSync(resolve("app/api/storage/signed-url/route.js"), "utf8");
  const proxy = readFileSync(resolve("proxy.js"), "utf8");
  const login = readFileSync(resolve("components/auth/PortalLoginForm.jsx"), "utf8");

  assert.match(list, /requireActivePanelUser/);
  assert.match(detail, /requireActivePanelUser/);
  assert.match(signed, /is_active !== false/);
  assert.match(proxy, /deactivated/);
  assert.match(proxy, /is_active === false/);
  assert.match(login, /deactivated/);
});

test("email-panel excludes deactivated panel portal emails", () => {
  const src = readFileSync(resolve("app/api/director/email-panel/route.js"), "utf8");
  assert.match(src, /is_active.*false|eq\("is_active", false\)/);
  assert.match(src, /deactivated panel portal/);
});

test("service-role key is never referenced in client components or director panel page", () => {
  const panelPage = readFileSync(resolve("app/(dashboard)/director/panel/page.js"), "utf8");
  assert.doesNotMatch(panelPage, /SERVICE_ROLE|service_role|createAdminClient/);
  assert.match(panelPage, /\/api\/director\/panel\/accounts/);
  assert.match(panelPage, /Deactivate/);
  assert.match(panelPage, /Permanently Delete/);
});

test("migration does not ON DELETE CASCADE interview_evaluations", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/202608030003_panel_account_lifecycle.sql"),
    "utf8"
  );
  assert.match(sql, /is_active/);
  assert.match(sql, /evaluator_name_snapshot/);
  assert.match(sql, /is_active_panel/);
  assert.doesNotMatch(sql, /interview_evaluations[\s\S]*ON DELETE CASCADE/i);
});
