import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

test("ApplicantOpenForum flyer asset exists", () => {
  assert.equal(
    existsSync(resolve("public/images/ksp-open-forum-aug-31-2026.png")),
    true
  );
});

test("ApplicantOpenForum has Zoom, mailto, and expiry", () => {
  const src = readFileSync(resolve("components/landing/ApplicantOpenForum.jsx"), "utf8");
  assert.match(src, /us06web\.zoom\.us\/j\/85695400835\?pwd=KSP8THCL/);
  assert.match(src, /target="_blank"/);
  assert.match(src, /rel="noopener noreferrer"/);
  assert.match(src, /mailto:twumgideonasare@gmail\.com|mailto:\$\{QUESTIONS_EMAIL\}/);
  assert.match(src, /2026-08-31T22:30:00/);
  assert.match(src, /856 9540 0835/);
  assert.match(src, /KSP8THCL/);
  assert.match(
    src,
    /Kufuor Scholars Program Open Forum with the Director and Management Team, 31 August 2026 at 8:30 PM/
  );
});

test("homepage places ApplicantOpenForum after Hero", () => {
  const src = readFileSync(resolve("app/(public)/page.js"), "utf8");
  assert.match(src, /import ApplicantOpenForum from "@\/components\/landing\/ApplicantOpenForum"/);
  const hero = src.indexOf("<Hero");
  const forum = src.indexOf("<ApplicantOpenForum");
  const why = src.indexOf("<WhyApply");
  assert.ok(hero !== -1 && forum !== -1 && why !== -1);
  assert.ok(hero < forum && forum < why);
});
