import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  APPLY_REGISTER_HREF,
  APPLY_PREP_HREF,
  applyNowHref,
  applyNowLabel,
  STAFF_APPLY_NOTICE,
} from "../lib/apply-cta.js";

test("apply CTA helpers stay in sync", () => {
  assert.equal(APPLY_REGISTER_HREF, "/applicant-register");
  assert.equal(APPLY_PREP_HREF, "/apply");
  assert.equal(applyNowHref(true), "/applicant-register");
  assert.equal(applyNowHref(false), "/apply");
  assert.equal(applyNowLabel(true), "Apply Now");
  assert.equal(STAFF_APPLY_NOTICE, "staff-session");
});

test("public Apply surfaces use shared ApplyNowCta or apply helpers", () => {
  const files = [
    "components/landing/Navbar.jsx",
    "components/landing/Hero.jsx",
    "components/landing/Footer.jsx",
    "components/landing/WhyApply.jsx",
    "components/landing/ApplyNowCta.jsx",
  ];
  for (const f of files) {
    assert.equal(existsSync(resolve(f)), true, f);
  }
  const navbar = readFileSync(resolve("components/landing/Navbar.jsx"), "utf8");
  const hero = readFileSync(resolve("components/landing/Hero.jsx"), "utf8");
  const footer = readFileSync(resolve("components/landing/Footer.jsx"), "utf8");
  assert.match(navbar, /ApplyNowCta/);
  assert.match(hero, /ApplyNowCta/);
  assert.match(hero, /HeroBackground/);
  const bg = readFileSync(resolve("components/landing/HeroBackground.jsx"), "utf8");
  assert.match(bg, /pointer-events-none/);
  assert.match(footer, /applyNowHref/);
  assert.match(footer, /applicationsOpen/);
});

test("proxy attaches staff Apply notice search params", () => {
  const proxy = readFileSync(resolve("proxy.js"), "utf8");
  assert.match(proxy, /authRouteBounceSearchParams/);
});
