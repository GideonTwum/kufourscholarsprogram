import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseYoutubeVideoUrl } from "../lib/youtube.js";
import { validateStage2Video } from "../lib/application-validation.js";

const ID = "abcdefghijk";
const CANONICAL = `https://www.youtube.com/watch?v=${ID}`;

const confirms = {
  confirms_youtube_public: true,
  confirms_youtube_title_format: true,
  confirms_youtube_description_concept: true,
};

function accepted(url) {
  const parsed = parseYoutubeVideoUrl(url);
  const errors = validateStage2Video({ video_youtube_url: url, ...confirms });
  assert.equal(errors.video_youtube_url, undefined, url);
  assert.equal(parsed.canonicalUrl, CANONICAL, url);
}

test("YouTube Shorts sharing links are accepted and normalized", () => {
  accepted(`https://youtube.com/shorts/${ID}?si=AbCdEfGhIj`);
  accepted(`https://www.youtube.com/shorts/${ID}`);
  accepted(`https://m.youtube.com/shorts/${ID}?si=xxxxx`);
});

test("standard and mobile watch links are accepted", () => {
  accepted(`https://youtube.com/watch?v=${ID}`);
  accepted(`https://www.youtube.com/watch?v=${ID}&feature=share`);
  accepted(`https://m.youtube.com/watch?v=${ID}`);
  accepted(`https://youtu.be/${ID}?si=xxxxx`);
});

test("deceptive hosts, bad ids, and playlist-only links are rejected", () => {
  const rejected = [
    "https://notyoutube.com/watch?v=abcdefghijk",
    "https://youtube.com.evil.com/shorts/abcdefghijk",
    "https://evil.com/youtube.com/shorts/abcdefghijk",
    "https://www.youtube.com/playlist?list=PLabcdefghij",
    "https://www.youtube.com/watch?list=PLabcdefghij",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/shorts/abcdefghijkl",
    "https://example.com",
  ];
  for (const url of rejected) {
    assert.equal(parseYoutubeVideoUrl(url), null, url);
    const errors = validateStage2Video({ video_youtube_url: url, ...confirms });
    assert.match(errors.video_youtube_url, /valid YouTube link/, url);
  }
});

test("stage 2 submit stores the canonical URL and still enforces the deadline", () => {
  const src = readFileSync(resolve("app/api/applications/submit-stage2/route.js"), "utf8");
  assert.match(src, /canonicalVideoUrl/);
  assert.match(src, /evaluateStage2DeadlineGate/);
  assert.match(src, /assertStatusTransition/);
  const page = readFileSync(resolve("app/(applicant)/applicant/stage2/page.js"), "utf8");
  assert.match(page, /validateStage2Video/);
});
