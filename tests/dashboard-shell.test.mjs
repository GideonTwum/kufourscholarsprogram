import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

test("shared DashboardShell exists with fixed sidebar scroll model", () => {
  const path = resolve("components/dashboard/DashboardShell.jsx");
  assert.ok(existsSync(path));
  const src = readFileSync(path, "utf8");
  assert.match(src, /h-dvh/);
  assert.match(src, /overflow-hidden/);
  assert.match(src, /fixed inset-y-0 left-0/);
  assert.match(src, /lg:pl-64/);
  assert.match(src, /overflow-y-auto/);
  assert.match(src, /min-h-0/);
  assert.match(src, /min-w-0/);
  assert.doesNotMatch(src, /lg:static/);
});

test("staff and applicant layouts use DashboardShell", () => {
  const staff = readFileSync(resolve("app/(dashboard)/layout.js"), "utf8");
  const applicant = readFileSync(resolve("app/(applicant)/layout.js"), "utf8");
  assert.match(staff, /DashboardShell/);
  assert.match(applicant, /DashboardShell/);
  assert.doesNotMatch(staff, /lg:static/);
  assert.doesNotMatch(applicant, /lg:static/);
});
