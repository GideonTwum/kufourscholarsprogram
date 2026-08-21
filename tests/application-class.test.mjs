import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_APPLICATION_CLASS_NAME,
  formatHeroBadge,
  formatOpenAnnouncement,
  formatSearchCampaign,
  formatStage2VideoTitle,
  resolveApplicationClassName,
  validateApplicationClassName,
} from "../lib/application-class.js";
import { sanitizeStage1ApplicationData } from "../lib/stage1-application-payload.js";

test("default Current Application Class is 11th Class", () => {
  assert.equal(DEFAULT_APPLICATION_CLASS_NAME, "11th Class");
});

test("validateApplicationClassName rejects blank and cohort wording", () => {
  assert.equal(validateApplicationClassName("").ok, false);
  assert.equal(validateApplicationClassName("   ").ok, false);
  assert.equal(validateApplicationClassName("11th Cohort").ok, false);
  const ok = validateApplicationClassName(" 12th Class ");
  assert.equal(ok.ok, true);
  assert.equal(ok.value, "12th Class");
});

test("resolveApplicationClassName prefers persisted Class over global", () => {
  assert.equal(
    resolveApplicationClassName({ application_class_name: "11th Class" }, "12th Class"),
    "11th Class"
  );
  assert.equal(resolveApplicationClassName({}, "12th Class"), "12th Class");
  assert.equal(resolveApplicationClassName({}, ""), "");
});

test("homepage messaging helpers respect open/closed state", () => {
  assert.equal(formatHeroBadge("11th Class", true), "11TH CLASS · APPLICATIONS OPEN");
  assert.equal(formatHeroBadge("11th Class", false), "11TH CLASS · APPLICATIONS CLOSED");
  assert.match(formatOpenAnnouncement("11th Class"), /11TH CLASS APPLICATIONS ARE NOW OPEN/);
  assert.equal(formatSearchCampaign("11th Class"), "The Search for the 11th Class Begins.");
  assert.doesNotMatch(formatHeroBadge("11th Class", false), /APPLICATIONS OPEN$/);
});

test("Stage 2 title uses Class terminology", () => {
  assert.equal(
    formatStage2VideoTitle("Gideon Asare Twum", "11th Class"),
    "Gideon Asare Twum - KSP 11th Class Application"
  );
  assert.doesNotMatch(formatStage2VideoTitle("Ama", "11th Class"), /cohort/i);
});

test("homepage promotes Class and removes Moments section", () => {
  const home = readFileSync(resolve("app/(public)/page.js"), "utf8");
  assert.match(home, /applicationClassName/);
  assert.doesNotMatch(home, /import Gallery|from \"@\/components\/landing\/Gallery\"|<Gallery/);
  assert.doesNotMatch(home, /Life at Kufuor Scholars/);
  assert.doesNotMatch(home, /MOMENTS/);

  const layout = readFileSync(resolve("app/(public)/layout.js"), "utf8");
  assert.match(layout, /SiteHeader/);
  assert.match(layout, /applicationClassName/);

  const hero = readFileSync(resolve("components/landing/Hero.jsx"), "utf8");
  assert.match(hero, /formatHeroBadge/);
  assert.match(hero, /formatSearchCampaign/);
  assert.doesNotMatch(hero, /Applications Open</);

  const banner = readFileSync(resolve("components/landing/ClassRecruitmentBanner.jsx"), "utf8");
  assert.match(banner, /formatOpenAnnouncement/);
  assert.doesNotMatch(banner, /ApplyNowCta/);
});

test("Director settings manage application_class_name", () => {
  const api = readFileSync(resolve("app/api/director/settings/route.js"), "utf8");
  assert.match(api, /application_class_name/);
  assert.match(api, /validateApplicationClassName/);

  const ui = readFileSync(resolve("app/(dashboard)/director/settings/page.js"), "utf8");
  assert.match(ui, /Current Application Class/);
  assert.match(ui, /application_class_name/);
  assert.doesNotMatch(ui, /Application cohort year/);
});

test("applicants cannot overwrite application_class_name via Stage 1 payload", () => {
  const { data, ignoredDangerousFields } = sanitizeStage1ApplicationData({
    full_name: "Test",
    application_class_name: "Hack Class",
  });
  assert.equal(data.application_class_name, undefined);
  assert.ok(ignoredDangerousFields.includes("application_class_name"));
});

test("migration adds application_class_name setting and column", () => {
  const path = resolve("supabase/migrations/202608210001_application_class_name.sql");
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /application_class_name/);
  assert.match(sql, /11th Class/);
  assert.match(sql, /stamp_application_class_name/);
});

test("active portal copy avoids unintended Cohort labels", () => {
  const files = [
    "app/(public)/apply/page.js",
    "app/(applicant)/applicant/stage2/page.js",
    "app/(dashboard)/director/settings/page.js",
    "components/landing/Hero.jsx",
    "lib/email/notify.js",
  ];
  for (const file of files) {
    const src = readFileSync(resolve(file), "utf8");
    assert.doesNotMatch(src, /\b[Cc]ohort\b/);
  }
});
