-- Applicant feedback fields + acceptance WhatsApp setting
-- Dual citizenship, JHS/SHS remain text columns (already present).
-- Idempotent where practical.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS has_dual_citizenship boolean DEFAULT false;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS second_citizenship_country text;

COMMENT ON COLUMN public.applications.has_dual_citizenship IS
  'Applicant indicated dual citizenship (Stage 1).';
COMMENT ON COLUMN public.applications.second_citizenship_country IS
  'Second country of citizenship when has_dual_citizenship is true.';

-- Site settings for accepted scholars WhatsApp group + cohort year for Stage 2 titles
INSERT INTO public.site_settings (key, value)
VALUES
  ('accepted_whatsapp_group_url', ''),
  ('application_cohort_year', '')
ON CONFLICT (key) DO NOTHING;
