import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEMO_NEWS_SLUGS,
  formatArticle,
  isPubliclyVisibleArticle,
  selectPublicArticles,
} from "../lib/news.js";
import { articles as staticArticles } from "../lib/news-data.js";

test("static news-data no longer ships demo articles for fallback", () => {
  assert.deepEqual(staticArticles, []);
});

test("public visibility requires published flag and non-future published_at", () => {
  const now = new Date("2026-08-25T12:00:00Z");
  const live = formatArticle({
    slug: "real-update",
    title: "Real Update",
    published_at: "2026-08-20T10:00:00Z",
    is_published: true,
  });
  const draft = formatArticle({
    slug: "draft",
    title: "Draft",
    published_at: "2026-08-20T10:00:00Z",
    is_published: false,
  });
  const future = formatArticle({
    slug: "future",
    title: "Future",
    published_at: "2026-09-01T10:00:00Z",
    is_published: true,
  });
  assert.equal(isPubliclyVisibleArticle(live, now), true);
  assert.equal(isPubliclyVisibleArticle(draft, now), false);
  assert.equal(isPubliclyVisibleArticle(future, now), false);
});

test("selectPublicArticles sorts newest first and respects limit", () => {
  const now = new Date("2026-08-25T12:00:00Z");
  const rows = [
    { slug: "a", title: "A", published_at: "2026-08-01", is_published: true },
    { slug: "b", title: "B", published_at: "2026-08-20", is_published: true },
    { slug: "c", title: "C", published_at: "2026-08-10", is_published: false },
  ];
  const selected = selectPublicArticles(rows, { limit: 10, now });
  assert.deepEqual(
    selected.map((a) => a.slug),
    ["b", "a"]
  );
});

test("homepage and news pages do not fall back to demo articles", () => {
  const home = readFileSync(resolve("app/(public)/page.js"), "utf8");
  const news = readFileSync(resolve("app/(public)/news/page.js"), "utf8");
  const slug = readFileSync(resolve("app/(public)/news/[slug]/page.js"), "utf8");
  const newsComp = readFileSync(resolve("components/landing/News.jsx"), "utf8");
  assert.match(home, /selectPublicArticles/);
  assert.match(home, /<News articles=\{newsArticles\}/);
  assert.match(news, /No news published yet/);
  assert.doesNotMatch(news, /fallbackArticles/);
  assert.doesNotMatch(slug, /fallbackArticles/);
  assert.doesNotMatch(newsComp, /defaultArticles/);
  assert.match(newsComp, /Never fall back to fabricated/);
});

test("demo seed slugs are documented for cleanup", () => {
  assert.ok(DEMO_NEWS_SLUGS.includes("alumni-youth-tech-initiative"));
  assert.ok(DEMO_NEWS_SLUGS.includes("afdb-mentorship-partnership"));
  const cleanup = readFileSync(resolve("docs/NEWS-DEMO-CONTENT-CLEANUP.sql"), "utf8");
  assert.match(cleanup, /alumni-youth-tech-initiative/);
  const migration = readFileSync(
    resolve("supabase/migrations/202608250001_news_articles_is_published.sql"),
    "utf8"
  );
  assert.match(migration, /is_published/);
});
