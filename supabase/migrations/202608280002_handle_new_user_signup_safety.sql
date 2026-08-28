-- Idempotent safety net for applicant Auth signup.
-- Ensures handle_new_user always creates an applicant profile (never trusts metadata.role)
-- and role CHECK includes applicant. Prevents "Database error saving new user" when
-- production drifted to an older trigger/constraint.
--
-- Does NOT disable email confirmation, RLS, or auto-confirm users.
-- Must be applied manually to production if not already present.

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

-- Ensure lifecycle column exists so INSERT defaults remain valid
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Auth signup: always insert applicant profile; ignore metadata.role. Hardening for launch.';
