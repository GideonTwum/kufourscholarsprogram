-- Assessor account lifecycle + recommendation governance + one-active-assessor.
-- Idempotent. Apply AFTER (in order):
--   202608030001_production_hardening.sql
--   202608030002_four_portal_roles.sql
--   202608030003_panel_account_lifecycle.sql
-- Then: 202608040001_assessor_account_lifecycle_and_governance.sql
--
-- Auth ban/unban/delete remain in server Admin API (not SQL).
-- Assessors recommend only; Directors set official application status.

-- ---------------------------------------------------------------------------
-- 1) Ensure shared lifecycle columns (no-op if already from panel migration)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles
SET is_active = true
WHERE role = 'assessor' AND is_active IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles (role, is_active);

-- ---------------------------------------------------------------------------
-- 2) Preserve assessment/assignment history: SET NULL instead of CASCADE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'application_assessments'
      AND constraint_name = 'application_assessments_assessor_id_fkey'
  ) THEN
    ALTER TABLE public.application_assessments
      DROP CONSTRAINT application_assessments_assessor_id_fkey;
  END IF;
END $$;

ALTER TABLE public.application_assessments
  ALTER COLUMN assessor_id DROP NOT NULL;

ALTER TABLE public.application_assessments
  ADD CONSTRAINT application_assessments_assessor_id_fkey
  FOREIGN KEY (assessor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'assessor_assignments'
      AND constraint_name = 'assessor_assignments_assessor_id_fkey'
  ) THEN
    ALTER TABLE public.assessor_assignments
      DROP CONSTRAINT assessor_assignments_assessor_id_fkey;
  END IF;
END $$;

-- assignments still require an assessor while active; keep NOT NULL on assessor_id
ALTER TABLE public.assessor_assignments
  ADD CONSTRAINT assessor_assignments_assessor_id_fkey
  FOREIGN KEY (assessor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 3) Recommendation allowlist (governance vocabulary)
-- ---------------------------------------------------------------------------
ALTER TABLE public.application_assessments
  DROP CONSTRAINT IF EXISTS application_assessments_recommendation_check;

UPDATE public.application_assessments
SET recommendation = CASE recommendation
  WHEN 'advance' THEN 'recommend_progress'
  WHEN 'hold' THEN 'recommend_hold'
  WHEN 'reject' THEN 'recommend_reject'
  ELSE recommendation
END
WHERE recommendation IN ('advance', 'hold', 'reject');

ALTER TABLE public.application_assessments
  ADD CONSTRAINT application_assessments_recommendation_check
  CHECK (
    recommendation IN (
      'recommend_progress',
      'recommend_hold',
      'recommend_reject',
      'recommend_interview',
      -- legacy (should be migrated above; keep briefly for safety)
      'advance',
      'hold',
      'reject'
    )
  );

-- Snapshots for attribution after deactivation
ALTER TABLE public.application_assessments
  ADD COLUMN IF NOT EXISTS assessor_name_snapshot text NULL;

ALTER TABLE public.application_assessments
  ADD COLUMN IF NOT EXISTS assessor_email_snapshot text NULL;

UPDATE public.application_assessments aa
SET
  assessor_name_snapshot = COALESCE(aa.assessor_name_snapshot, NULLIF(p.full_name, ''), p.email),
  assessor_email_snapshot = COALESCE(aa.assessor_email_snapshot, p.email)
FROM public.profiles p
WHERE aa.assessor_id = p.id
  AND (aa.assessor_name_snapshot IS NULL OR aa.assessor_email_snapshot IS NULL);

CREATE OR REPLACE FUNCTION public.set_application_assessment_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pname text;
  pemail text;
BEGIN
  IF NEW.assessor_id IS NOT NULL THEN
    SELECT full_name, email INTO pname, pemail
    FROM public.profiles
    WHERE id = NEW.assessor_id;

    IF NEW.assessor_name_snapshot IS NULL OR NEW.assessor_name_snapshot = '' THEN
      NEW.assessor_name_snapshot := COALESCE(NULLIF(pname, ''), pemail, 'Assessor');
    END IF;
    IF NEW.assessor_email_snapshot IS NULL OR NEW.assessor_email_snapshot = '' THEN
      NEW.assessor_email_snapshot := pemail;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_application_assessment_snapshots ON public.application_assessments;
CREATE TRIGGER trg_set_application_assessment_snapshots
  BEFORE INSERT OR UPDATE OF assessor_id ON public.application_assessments
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_application_assessment_snapshots();

-- ---------------------------------------------------------------------------
-- 4) One active assessor assignment per application
-- ---------------------------------------------------------------------------
-- Close duplicate actives (keep newest assigned_at per application)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY assigned_at DESC NULLS LAST, id DESC) AS rn
  FROM public.assessor_assignments
  WHERE status = 'active'
)
UPDATE public.assessor_assignments a
SET status = 'reassigned', completed_at = COALESCE(a.completed_at, now())
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS assessor_assignments_one_active_per_application
  ON public.assessor_assignments (application_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 5) Active assessor helpers + RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_assessor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'assessor'
      AND COALESCE(is_active, true) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assessor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_assessor();
$$;

-- Re-assert assessor read policies use is_assessor() (now active-aware)
DROP POLICY IF EXISTS "Assessors can read assigned applications" ON public.applications;
CREATE POLICY "Assessors can read assigned applications"
  ON public.applications
  FOR SELECT
  USING (
    public.is_assessor()
    AND EXISTS (
      SELECT 1
      FROM public.assessor_assignments aa
      WHERE aa.application_id = applications.id
        AND aa.assessor_id = auth.uid()
        AND aa.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Assessors can read assigned applicant profiles" ON public.profiles;
CREATE POLICY "Assessors can read assigned applicant profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.is_assessor()
    AND (
      id = auth.uid()
      OR id IN (
        SELECT a.user_id
        FROM public.applications a
        JOIN public.assessor_assignments aa ON aa.application_id = a.id
        WHERE aa.assessor_id = auth.uid()
          AND aa.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Assessors can read assigned applicant uploads" ON storage.objects;
CREATE POLICY "Assessors can read assigned applicant uploads"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'applications'
    AND public.is_assessor()
    AND (storage.foldername(name))[1] IN (
      SELECT a.user_id::text
      FROM public.applications a
      JOIN public.assessor_assignments aa ON aa.application_id = a.id
      WHERE aa.assessor_id = auth.uid()
        AND aa.status = 'active'
    )
  );

DROP POLICY IF EXISTS "assessors can manage own assessments" ON public.application_assessments;
CREATE POLICY "assessors can manage own assessments"
  ON public.application_assessments
  FOR ALL
  USING (assessor_id = auth.uid() AND public.is_assessor())
  WITH CHECK (assessor_id = auth.uid() AND public.is_assessor());

DROP POLICY IF EXISTS "directors can read application assessments" ON public.application_assessments;
CREATE POLICY "directors can read application assessments"
  ON public.application_assessments
  FOR SELECT
  USING (public.is_director());

COMMENT ON INDEX public.assessor_assignments_one_active_per_application IS
  'Launch model: at most one active assessor assignment per application.';
