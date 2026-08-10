import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

test("hero uses real group photo in a right-side panel (no slideshow, no mockup)", () => {
  const bgPath = resolve("components/landing/HeroBackground.jsx");
  assert.equal(existsSync(bgPath), true);
  const src = readFileSync(bgPath, "utf8");

  assert.match(src, /HERO_PHOTO|scholars-formal-1\.png/);
  assert.match(src, /\/hero\/scholars-formal-1\.png/);
  assert.doesNotMatch(src, /ksp-group-hero|ChatGPT/i);
  assert.doesNotMatch(src, /src:\s*["'][^"']*ksp-group-hero/);
  assert.doesNotMatch(src, /HERO_SLIDES|setInterval|setTimeout|AnimatePresence|activeSlide|Ken Burns/i);
  assert.match(src, /pointer-events-none/);
  assert.match(src, /w-\[58%\]|w-\[52%\]/);
  assert.match(src, /linear-gradient\(\s*90deg/);
  assert.match(src, /alt=""/);
  assert.match(src, /priority/);
  assert.match(src, /aria-hidden/);
});

test("real hero photograph exists; mockup asset is not shipped", () => {
  assert.equal(existsSync(resolve("public/hero/scholars-formal-1.png")), true);
  assert.equal(existsSync(resolve("public/hero/ksp-group-hero.png")), false);
});

test("HeroBackgroundSlideshow is removed", () => {
  assert.equal(existsSync(resolve("components/landing/HeroBackgroundSlideshow.jsx")), false);
});

test("Hero wires static background and keeps CTAs / left content", () => {
  const hero = readFileSync(resolve("components/landing/Hero.jsx"), "utf8");
  assert.match(hero, /HeroBackground/);
  assert.doesNotMatch(hero, /HeroBackgroundSlideshow|HERO_SLIDES|activeSlide/);
  assert.match(hero, /Rewiring Future/);
  assert.match(hero, /Leaders of Africa/);
  assert.match(hero, /ApplyNowCta/);
  assert.match(hero, /Meet Our Scholars/);
  assert.match(hero, /z-10/);
  assert.match(hero, /text-left/);
});
