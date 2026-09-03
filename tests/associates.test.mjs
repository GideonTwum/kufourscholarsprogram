import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  ASSOCIATES_APPLY_URL,
  ASSOCIATES_PAGE_HREF,
  ASSOCIATES_PHOTOS,
} from "../lib/associates.js";

test("Associates portal uses the official custom subdomain", () => {
  assert.equal(ASSOCIATES_APPLY_URL, "https://apply.kufuorscholarapplication.com");
  assert.equal(ASSOCIATES_PAGE_HREF, "/associates");
  assert.doesNotMatch(ASSOCIATES_APPLY_URL, /vercel\.app/);
});

test("Associates photos reuse existing public assets", () => {
  for (const photo of Object.values(ASSOCIATES_PHOTOS)) {
    assert.equal(existsSync(resolve(`public${photo.src}`)), true, photo.src);
  }
});

test("homepage Associates section wires CTAs and distinction copy", () => {
  const src = readFileSync(resolve("components/landing/AssociatesSection.jsx"), "utf8");
  assert.match(src, /Join the Associates Community/);
  assert.match(src, /ASSOCIATES_APPLY_URL/);
  assert.match(src, /ASSOCIATES_PAGE_HREF/);
  assert.match(src, /not designated as Kufuor Scholars/);
  assert.doesNotMatch(src, /failed applicants|consolation|rejected applicants/i);
});

test("associates page keeps Scholars vs Associates clarity and safe CTAs", () => {
  const src = readFileSync(resolve("components/associates/AssociatesPage.jsx"), "utf8");
  assert.match(src, /ASSOCIATES_APPLY_URL/);
  assert.match(src, /target="_blank"/);
  assert.match(src, /rel="noopener noreferrer"/);
  assert.match(src, /does not mean that an individual\s+is a Kufuor Scholar/);
  assert.match(src, /Are not designated as Kufuor Scholars/);
  assert.match(src, /who-associates-is-for/);
  assert.doesNotMatch(src, /kufuorscholarassociates\.vercel\.app/);
  assert.doesNotMatch(src, /failed applicants|consolation|backup programme/i);
});

test("homepage places AssociatesSection after ProgramHighlights", () => {
  const src = readFileSync(resolve("app/(public)/page.js"), "utf8");
  const highlights = src.indexOf("<ProgramHighlights");
  const associates = src.indexOf("<AssociatesSection");
  const stats = src.indexOf("<Stats");
  assert.ok(highlights !== -1 && associates !== -1 && stats !== -1);
  assert.ok(highlights < associates && associates < stats);
});

test("associates route exists with metadata", () => {
  const src = readFileSync(resolve("app/(public)/associates/page.js"), "utf8");
  assert.match(src, /Kufuor Scholar Associates \| Kufuor Scholars Program/);
  assert.match(src, /AssociatesPage/);
});
