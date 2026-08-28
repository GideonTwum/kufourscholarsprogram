/**
 * Public news helpers.
 *
 * Canonical source of truth: public.news_articles (Director CMS at /director/news).
 * Do NOT fall back to fabricated/demo articles on public pages.
 */

import { categoryColors } from "./news-data.js";

export { categoryColors };

/** Known demo/seed article slugs from supabase-migration-news.sql / historical lib/news-data. */
export const DEMO_NEWS_SLUGS = [
  "applications-open-cohort-2026",
  "leadership-summit-record-attendance",
  "alumni-youth-tech-initiative",
  "afdb-mentorship-partnership",
  "community-service-week-2025",
  "cohort-2025-graduation",
];

/**
 * Format a news_articles DB row for public UI.
 * @param {object} row
 */
export function formatArticle(row) {
  if (!row) return null;
  const publishedAt = row.published_at ? new Date(row.published_at) : null;
  return {
    id: row.id,
    slug: row.slug,
    category: row.category || "Program",
    title: row.title,
    excerpt: row.excerpt || "",
    body: row.body || "",
    image: row.image || "/scholars14.jpg",
    featured: !!row.featured,
    isPublished: row.is_published !== false,
    date: publishedAt
      ? publishedAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "",
    readTime: row.read_time || "3 min read",
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
  };
}

export function getCategoryColor(category) {
  return categoryColors[category] || "bg-gray-100 text-gray-700";
}

/**
 * Whether a formatted article is eligible for public display.
 * - must be published (is_published !== false)
 * - published_at must exist and not be in the future
 */
export function isPubliclyVisibleArticle(article, now = new Date()) {
  if (!article?.slug || !article?.title) return false;
  if (article.isPublished === false) return false;
  if (!article.publishedAt) return false;
  return article.publishedAt.getTime() <= now.getTime();
}

/**
 * Apply public visibility + newest-first sort.
 * @param {object[]} rows raw or formatted
 */
export function selectPublicArticles(rows, { limit = null, now = new Date() } = {}) {
  const formatted = (rows || []).map((r) => (r.publishedAt !== undefined ? r : formatArticle(r))).filter(Boolean);
  const visible = formatted
    .filter((a) => isPubliclyVisibleArticle(a, now))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  if (limit != null && limit >= 0) return visible.slice(0, limit);
  return visible;
}
