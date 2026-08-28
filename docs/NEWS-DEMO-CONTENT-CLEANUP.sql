-- Diagnostic / optional cleanup for demo seed news (DO NOT run blindly in production).
-- Review rows first. Delete only confirmed fabricated/demo articles.

-- 1) List known demo/seed slugs (from supabase-migration-news.sql)
SELECT id, slug, title, published_at, featured, is_published
FROM public.news_articles
WHERE slug IN (
  'applications-open-cohort-2026',
  'leadership-summit-record-attendance',
  'alumni-youth-tech-initiative',
  'afdb-mentorship-partnership',
  'community-service-week-2025',
  'cohort-2025-graduation'
)
ORDER BY published_at DESC;

-- 2) Optional: unpublish demo rows instead of deleting
-- UPDATE public.news_articles
-- SET is_published = false, updated_at = now()
-- WHERE slug IN (
--   'applications-open-cohort-2026',
--   'leadership-summit-record-attendance',
--   'alumni-youth-tech-initiative',
--   'afdb-mentorship-partnership',
--   'community-service-week-2025',
--   'cohort-2025-graduation'
-- );

-- 3) Optional: hard-delete demo rows after Director confirmation
-- DELETE FROM public.news_articles
-- WHERE slug IN (
--   'applications-open-cohort-2026',
--   'leadership-summit-record-attendance',
--   'alumni-youth-tech-initiative',
--   'afdb-mentorship-partnership',
--   'community-service-week-2025',
--   'cohort-2025-graduation'
-- );
