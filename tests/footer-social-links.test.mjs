import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getSocialLinks,
  KSP_PUBLIC_SOCIAL_PLATFORMS,
  KSP_SOCIAL_PROFILE_URLS,
} from "../lib/social-links.js";

const EXPECTED = {
  instagram:
    "https://www.instagram.com/kufuor_scholars_program?igsi=MW00OGNzMTc5ZmJ5OQ==",
  tiktok: "https://www.tiktok.com/@kufuorscholars?_r=1&_t=ZS-993WQyXTkbx",
  linkedin: "https://www.linkedin.com/company/kufuor-scholars-program/",
  youtube: "https://www.youtube.com/results?search_query=%40kufuorscholars",
};

test("public social config exposes Instagram, TikTok, LinkedIn, YouTube in that order", () => {
  assert.deepEqual(KSP_PUBLIC_SOCIAL_PLATFORMS, [
    "instagram",
    "tiktok",
    "linkedin",
    "youtube",
  ]);
  const links = getSocialLinks();
  assert.deepEqual(Object.keys(links).sort(), [
    "instagram",
    "linkedin",
    "tiktok",
    "youtube",
  ]);
  assert.equal("facebook" in links, false);
  assert.equal("twitter" in links, false);
});

test("official operator-supplied profile URLs are configured", () => {
  assert.deepEqual(KSP_SOCIAL_PROFILE_URLS, EXPECTED);
  assert.deepEqual(getSocialLinks(), EXPECTED);
});

test("footer renders four clickable social links and drops Facebook/X", () => {
  const footer = readFileSync(resolve("components/landing/Footer.jsx"), "utf8");
  assert.match(footer, /Instagram/);
  assert.match(footer, /TikTok/);
  assert.match(footer, /LinkedIn/);
  assert.match(footer, /YouTube/);
  assert.match(footer, /KSP_PUBLIC_SOCIAL_PLATFORMS/);
  assert.match(footer, /getSocialLinks/);
  assert.match(footer, /target="_blank"/);
  assert.match(footer, /rel="noopener noreferrer"/);
  assert.match(footer, /Kufuor Scholars Program on Instagram/);
  assert.match(footer, /Kufuor Scholars Program on TikTok/);
  assert.match(footer, /Kufuor Scholars Program on LinkedIn/);
  assert.match(footer, /Kufuor Scholars Program on YouTube/);
  assert.doesNotMatch(footer, /Facebook|Twitter|icon: Facebook|icon: Twitter/);
  assert.doesNotMatch(footer, /link not configured|URL not configured/);
});

test("contact Follow Us uses shared social config with real links only", () => {
  const contact = readFileSync(resolve("components/landing/Contact.jsx"), "utf8");
  assert.match(contact, /getSocialLinks/);
  assert.match(contact, /KSP_PUBLIC_SOCIAL_PLATFORMS/);
  assert.match(contact, /target="_blank"/);
  assert.match(contact, /rel="noopener noreferrer"/);
  assert.doesNotMatch(contact, /instagram\.com|tiktok\.com|linkedin\.com|youtube\.com/);
  assert.doesNotMatch(contact, /Facebook|Twitter|icon: Facebook|icon: Twitter/);
  assert.doesNotMatch(contact, /link not configured|URL not configured/);
});
