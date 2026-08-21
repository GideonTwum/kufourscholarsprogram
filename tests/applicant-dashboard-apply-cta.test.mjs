import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("authenticated Stage 1 page has no public Apply recruitment CTA", () => {
  const page = readFileSync(
    resolve("app/(applicant)/applicant/application/page.js"),
    "utf8"
  );
  assert.match(page, /Stage 1: Initial Application/);
  assert.match(page, /Complete all steps to submit your Stage 1 application/);
  assert.doesNotMatch(page, /New to the program\? Apply now/);
  assert.doesNotMatch(page, /href=["']\/apply["']/);
  assert.doesNotMatch(page, /ApplyNowCta/);
  assert.doesNotMatch(page, /Create an account/);
  assert.doesNotMatch(page, /Start your application/);
});

test("other authenticated applicant pages have no public Apply recruitment CTAs", () => {
  const paths = [
    "app/(applicant)/applicant/page.js",
    "app/(applicant)/applicant/stage2/page.js",
    "app/(applicant)/applicant/profile/page.js",
  ];
  for (const path of paths) {
    const src = readFileSync(resolve(path), "utf8");
    assert.doesNotMatch(
      src,
      /New to the program\? Apply now/,
      `${path} must not show public Apply CTA`
    );
    assert.doesNotMatch(src, /ApplyNowCta/, `${path} must not import ApplyNowCta`);
    assert.doesNotMatch(
      src,
      /href=["']\/applicant-register["']/,
      `${path} must not link to applicant-register`
    );
  }
});

test("public homepage still exposes Apply Now CTA", () => {
  const home = readFileSync(resolve("app/(public)/page.js"), "utf8");
  const hero = readFileSync(resolve("components/landing/Hero.jsx"), "utf8");
  assert.match(home, /<Hero/);
  assert.match(hero, /Apply Now/);
});
