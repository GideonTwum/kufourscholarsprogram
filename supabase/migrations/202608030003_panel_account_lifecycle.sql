-- Staff account lifecycle (panel + assessor reusable) + evaluation attribution snapshots.
-- Idempotent. Does not cascade-delete interview_evaluations.

-- ---------------------------------------------------------------------------
-- 1) Shared lifecycle columns on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles SET is_active = true WHERE is_active IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles (role, is_active);

-- ---------------------------------------------------------------------------
-- 2) Immutable evaluator snapshots on interview_evaluations
-- ---------------------------------------------------------------------------
ALTER TABLE public.interview_evaluations
  ADD COLUMN IF NOT EXISTS evaluator_name_snapshot text NULL;

ALTER TABLE public.interview_evaluations
  ADD COLUMN IF NOT EXISTS evaluator_email_snapshot text NULL;

UPDATE public.interview_evaluations ie
SET
  evaluator_name_snapshot = COALESCE(ie.evaluator_name_snapshot, NULLIF(p.full_name, ''), p.email),
  evaluator_email_snapshot = COALESCE(ie.evaluator_email_snapshot, p.email)
FROM public.profiles p
WHERE ie.evaluator_id = p.id
  AND (ie.evaluator_name_snapshot IS NULL OR ie.evaluator_email_snapshot IS NULL);

-- Auto-fill snapshots on insert/update when evaluator_id set
CREATE OR REPLACE FUNCTION public.set_interview_evaluation_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pname text;
  pemail text;
BEGIN
  IF NEW.evaluator_id IS NOT NULL THEN
    SELECT full_name, email INTO pname, pemail
    FROM public.profiles
    WHERE id = NEW.evaluator_id;

    IF NEW.evaluator_name_snapshot IS NULL OR NEW.evaluator_name_snapshot = '' THEN
      NEW.evaluator_name_snapshot := COALESCE(NULLIF(pname, ''), pemail, 'Panel Member');
    END IF;
    IF NEW.evaluator_email_snapshot IS NULL OR NEW.evaluator_email_snapshot = '' THEN
      NEW.evaluator_email_snapshot := pemail;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_interview_evaluation_snapshots ON public.interview_evaluations;
CREATE TRIGGER trg_set_interview_evaluation_snapshots
  BEFORE INSERT OR UPDATE OF evaluator_id ON public.interview_evaluations
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_interview_evaluation_snapshots();

-- ---------------------------------------------------------------------------
-- 3) Active panel helper (used by RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_panel()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'panel'
      AND COALESCE(is_active, true) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_panel()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_active_panel();
$$;

-- Keep is_director / is_assessor active-aware for staff portals
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

-- Re-bind panel evaluation write policies to active panel only
DROP POLICY IF EXISTS "Panel can insert own evaluations" ON public.interview_evaluations;
CREATE POLICY "Panel can insert own evaluations" ON public.interview_evaluations
  FOR INSERT WITH CHECK (
    evaluator_id = auth.uid()
    AND public.is_active_panel()
  );

DROP POLICY IF EXISTS "Panel can update own evaluations" ON public.interview_evaluations;
CREATE POLICY "Panel can update own evaluations" ON public.interview_evaluations
  FOR UPDATE
  USING (evaluator_id = auth.uid() AND public.is_active_panel())
  WITH CHECK (evaluator_id = auth.uid() AND public.is_active_panel());

-- Directors retain full read of evaluations (history)
DROP POLICY IF EXISTS "Directors can read interview_evaluations" ON public.interview_evaluations;
CREATE POLICY "Directors can read interview_evaluations" ON public.interview_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'director'
    )
  );
