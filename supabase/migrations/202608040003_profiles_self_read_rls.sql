-- Fix profiles SELECT so staff (including Directors) can read their own row after login.
-- Symptom: Auth succeeds, then UI shows profile load / database permissions error.
-- Root cause: missing own-row SELECT policy, recursive director policies, and/or missing GRANTs.
--
-- Apply after 202608040002_director_security_operations.sql (idempotent).
-- Does NOT weaken RLS: grants only allow the role to attempt SELECT; policies still enforce rows.

-- ---------------------------------------------------------------------------
-- 0) Table privileges for PostgREST roles (RLS still applies)
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

-- ---------------------------------------------------------------------------
-- 1) Security-definer helpers (bypass RLS; avoid recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'director'
      AND COALESCE(is_active, true) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_director()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_director();
$$;

-- ---------------------------------------------------------------------------
-- 2) Ensure every authenticated user can read their own profile row
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Directors may read all profiles (via helper — no profiles self-subquery)
DROP POLICY IF EXISTS "Directors can read all profiles" ON public.profiles;
CREATE POLICY "Directors can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_director());

-- Contact Director / messaging: authenticated users can see director directory rows
DROP POLICY IF EXISTS "Authenticated can read director profiles" ON public.profiles;
CREATE POLICY "Authenticated can read director profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND role = 'director');

-- ---------------------------------------------------------------------------
-- 3) Own-profile update (non-privileged columns still gated by trigger)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 4) Fix recursive director check on interview_evaluations (if present)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Directors can read interview_evaluations" ON public.interview_evaluations;
CREATE POLICY "Directors can read interview_evaluations"
  ON public.interview_evaluations
  FOR SELECT
  USING (public.is_director());
