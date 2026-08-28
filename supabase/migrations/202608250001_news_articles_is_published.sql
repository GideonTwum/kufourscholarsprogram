-- News articles: add explicit publish flag for public homepage/news pages.
-- Existing rows default to published=true so current legitimate CMS content stays visible.
-- Directors can unpublish drafts without deleting.
--
-- Does NOT delete seed/demo rows automatically — review and remove via Director News UI
-- or the companion diagnostic in docs/NEWS-DEMO-CONTENT-CLEANUP.sql

ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.news_articles.is_published IS
  'When false, article is hidden from public /news and homepage. Director CMS can still edit.';

CREATE INDEX IF NOT EXISTS idx_news_articles_public_list
  ON public.news_articles (published_at DESC)
  WHERE is_published = true;
