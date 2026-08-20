-- Stage 1 testing changes: Student ID document, KSP social follow screenshots,
-- multi recommendation letters (jsonb array + legacy single path).
-- Nullable for backward compatibility with historical applications.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS student_id_path text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ksp_tiktok_follow_screenshot_path text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ksp_linkedin_follow_screenshot_path text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ksp_instagram_follow_screenshot_path text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS recommendation_urls jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.applications.student_id_path IS
  'Private storage path for Student ID document (PDF/image). Required for new Stage 1 submissions.';

COMMENT ON COLUMN public.applications.ksp_tiktok_follow_screenshot_path IS
  'Private storage path for screenshot evidence of following @kufuorscholars on TikTok.';

COMMENT ON COLUMN public.applications.ksp_linkedin_follow_screenshot_path IS
  'Private storage path for screenshot evidence of following Kufuor Scholars Program on LinkedIn.';

COMMENT ON COLUMN public.applications.ksp_instagram_follow_screenshot_path IS
  'Private storage path for screenshot evidence of following @kufuor_scholars_program on Instagram.';

COMMENT ON COLUMN public.applications.recommendation_urls IS
  'JSON array of recommendation letter storage paths. New submissions require at least two. Legacy recommendation_url remains for historical rows.';

-- Backfill array from legacy single recommendation path when empty.
UPDATE public.applications
SET recommendation_urls = jsonb_build_array(recommendation_url)
WHERE recommendation_url IS NOT NULL
  AND btrim(recommendation_url) <> ''
  AND (
    recommendation_urls IS NULL
    OR recommendation_urls = '[]'::jsonb
    OR jsonb_typeof(recommendation_urls) <> 'array'
  );
