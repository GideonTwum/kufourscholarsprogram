-- Align profiles.role to launch four-portal model (+ scholar after acceptance).
-- Idempotent. Map legacy misspellings and accidental staff rename leftovers.

UPDATE public.profiles SET role = 'assessor' WHERE role IN ('accessor', 'accessors');
UPDATE public.profiles SET role = 'director' WHERE role IN ('administrator', 'super_administrator', 'admin');

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
  CHECK (role IN ('applicant', 'assessor', 'panel', 'director', 'scholar'));

-- Verification:
-- SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY 1;
