import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("SiteHeader stacks banner above navbar and reserves spacer", () => {
  const header = readFileSync(resolve("components/landing/SiteHeader.jsx"), "utf8");
  assert.match(header, /ClassRecruitmentBanner/);
  assert.match(header, /Navbar/);
  assert.match(header, /embedded/);
  assert.match(header, /data-site-header-spacer/);
  assert.match(header, /--site-header-height/);
  assert.match(header, /fixed inset-x-0 top-0/);

  // Banner appears before Navbar in JSX order
  const bannerIdx = header.indexOf("<ClassRecruitmentBanner");
  const navIdx = header.indexOf("<Navbar");
  assert.ok(bannerIdx >= 0 && navIdx > bannerIdx);
});

test("public layout uses SiteHeader instead of bare Navbar", () => {
  const layout = readFileSync(resolve("app/(public)/layout.js"), "utf8");
  assert.match(layout, /SiteHeader/);
  assert.match(layout, /applicationClassName/);
  assert.doesNotMatch(layout, /import Navbar from/);
});

test("homepage does not render ClassRecruitmentBanner in page body", () => {
  const home = readFileSync(resolve("app/(public)/page.js"), "utf8");
  assert.doesNotMatch(home, /ClassRecruitmentBanner/);
  assert.match(home, /<Hero/);
});

test("recruitment banner is compact and has no Apply CTA", () => {
  const banner = readFileSync(resolve("components/landing/ClassRecruitmentBanner.jsx"), "utf8");
  assert.match(banner, /formatOpenAnnouncement/);
  assert.match(banner, /data-recruitment-banner/);
  assert.match(banner, /h-9|h-10/);
  assert.doesNotMatch(banner, /ApplyNowCta/);
  assert.doesNotMatch(banner, /bg-gold px-4/);
});

test("navbar keeps one primary ApplyNowCta when embedded", () => {
  const navbar = readFileSync(resolve("components/landing/Navbar.jsx"), "utf8");
  assert.match(navbar, /embedded/);
  assert.match(navbar, /ApplyNowCta/);
  // Embedded path must not use its own fixed top-0 (SiteHeader owns fixed)
  assert.match(navbar, /embedded\s*\?\s*"border-b border-gray-100/);
  const applyCount = (navbar.match(/<ApplyNowCta/g) || []).length;
  // Desktop + mobile CTAs (open and closed branches share components)
  assert.ok(applyCount >= 2);
});

test("open/closed banner behavior remains applicationsOpen gated", () => {
  const banner = readFileSync(resolve("components/landing/ClassRecruitmentBanner.jsx"), "utf8");
  assert.match(banner, /if \(!applicationsOpen\) return null/);
});
