-- =============================================================================
-- Production hardening (launch)
-- Canonical staff role remains: director
-- DO NOT introduce administrator / super_administrator here.
--
-- Impact on production data:
-- 1) handle_new_user always inserts role = applicant (ignores signup metadata).
-- 2) Profiles cannot self-change role (or class_name) unless is_director().
-- 3) Applicants cannot change applications.status via client (service_role / director OK).
-- 4) applications_status_check aligned to launch statuses.
-- 5) Any accidental administrator / super_administrator rows remapped to director.
-- =============================================================================

-- Remap accidental renamed staff roles back to launch canonical "director"
UPDATE public.profiles
SET role = 'director'
WHERE role IN ('administrator', 'super_administrator');

-- Ensure profiles.role check allows launch roles (idempotent drop/add)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('applicant', 'director', 'panel', 'assessor', 'scholar'));

-- -----------------------------------------------------------------------------
-- Public signup: ALWAYS applicant (ignore metadata.role)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, class_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'applicant',
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  -- Never update role from Auth metadata on conflict
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Prevent role / class_name self-promotion on profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses (staff invites / RPCs use service role)
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Directors may change role/class (e.g. promote scholar via other flows)
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'director'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing profile role is not allowed';
  END IF;

  IF NEW.class_name IS DISTINCT FROM OLD.class_name THEN
    RAISE EXCEPTION 'Changing class_name is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_profile_privileged_columns();

-- -----------------------------------------------------------------------------
-- Applicants cannot tamper with application status / server fields
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_application_status_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('director', 'assessor', 'panel')
  ) THEN
    -- Panel should not change status; assessor/director updates usually use service_role.
    -- Block panel explicitly; allow director/assessor only if not panel.
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'panel'
    ) THEN
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        RAISE EXCEPTION 'Panel members cannot change application status';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Applicant / scholar / others: freeze privileged columns
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Applicants cannot change application status';
  END IF;
  IF NEW.director_notes IS DISTINCT FROM OLD.director_notes THEN
    RAISE EXCEPTION 'Applicants cannot change director notes';
  END IF;
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Applicants cannot change rejection reason';
  END IF;
  IF NEW.interview_date IS DISTINCT FROM OLD.interview_date
     OR NEW.interview_time IS DISTINCT FROM OLD.interview_time
     OR NEW.interview_location IS DISTINCT FROM OLD.interview_location
     OR NEW.interview_instructions IS DISTINCT FROM OLD.interview_instructions
     OR NEW.interview_slot_id IS DISTINCT FROM OLD.interview_slot_id THEN
    RAISE EXCEPTION 'Applicants cannot change interview fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_application_status_columns ON public.applications;
CREATE TRIGGER trg_protect_application_status_columns
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_application_status_columns();

-- -----------------------------------------------------------------------------
-- Canonical status CHECK (launch)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.applications'::regclass
      AND conname = 'applications_status_check'
  ) THEN
    ALTER TABLE public.applications DROP CONSTRAINT applications_status_check;
  END IF;
END $$;

-- Map known legacy statuses before adding CHECK
UPDATE public.applications SET status = 'stage_1_submitted' WHERE status IN ('pending', 'stage1_submitted', 'submitted');
UPDATE public.applications SET status = 'review_pending' WHERE status IN ('under_review');
UPDATE public.applications SET status = 'stage_1_approved' WHERE status IN ('shortlisted_for_stage2', 'shortlisted');
UPDATE public.applications SET status = 'stage_2_submitted' WHERE status IN ('stage2_submitted');

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check
  CHECK (
    status IN (
      'draft',
      'stage_1_submitted',
      'review_pending',
      'stage_1_approved',
      'stage_2_submitted',
      'stage_2_review_pending',
      'stage_2_approved',
      'called_for_interview',
      'interview',
      'interview_review_pending',
      'accepted',
      'rejected'
    )
  );

-- -----------------------------------------------------------------------------
-- Verification helpers (read-only queries for ops)
-- -----------------------------------------------------------------------------
-- Confirm handle_new_user ignores metadata:
--   SELECT pg_get_functiondef('public.handle_new_user'::regproc);
-- Confirm role protection trigger exists:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass;
-- Confirm status check:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.applications'::regclass AND conname = 'applications_status_check';
