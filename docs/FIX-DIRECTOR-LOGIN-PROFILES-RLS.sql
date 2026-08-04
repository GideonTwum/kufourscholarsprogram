-- Quick fix: Director/staff login cannot SELECT own profiles row (PostgREST error, not empty row).
-- Run in Supabase SQL Editor on the SAME project as NEXT_PUBLIC_SUPABASE_URL.
-- Same intent as supabase/migrations/202608040003_profiles_self_read_rls.sql

-- Grants (RLS still enforces which rows are visible)
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

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

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Directors can read all profiles" ON public.profiles;
CREATE POLICY "Directors can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_director());

DROP POLICY IF EXISTS "Authenticated can read director profiles" ON public.profiles;
CREATE POLICY "Authenticated can read director profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND role = 'director');

-- Inspect policies (look for EXISTS (SELECT … FROM profiles) recursion)
SELECT policyname, cmd, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- Confirm director row (service role / SQL editor bypasses RLS)
SELECT id, email, role, is_active
FROM public.profiles
WHERE email = 'asaretwum@gmail.com';
