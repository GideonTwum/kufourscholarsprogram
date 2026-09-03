-- Additive Stage 1 demographics: gender for applicant reporting.
-- Nullable for historical applications; app/server require male|female on new Stage 1 submit.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN public.applications.gender IS
  'Applicant gender for Stage 1 demographics. Allowed: male, female. NULL permitted for legacy rows submitted before this field existed.';

-- Backwards-compatible check: allow NULL (legacy) or canonical values only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applications_gender_allowed_check'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_gender_allowed_check
      CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
END $$;
