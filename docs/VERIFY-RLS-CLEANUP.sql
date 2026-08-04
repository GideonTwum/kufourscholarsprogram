-- =============================================================================
-- VERIFY: 202608040004_cleanup_director_and_interview_rls.sql
-- Run in Supabase SQL Editor (read-only checks).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Policies that still reference FROM profiles (inline)
-- Expected: ONLY conversation_members policy "Group class roster sync"
-- (and possibly none if that policy was never created in this environment)
-- -----------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '') ILIKE '%from%profiles%'
    OR coalesce(with_check, '') ILIKE '%from%profiles%'
    OR coalesce(qual, '') ILIKE '%from public.profiles%'
    OR coalesce(with_check, '') ILIKE '%from public.profiles%'
  )
ORDER BY tablename, policyname;

-- Narrow expectation check (optional filter for human review):
-- Acceptable leftover: conversation_members / Group class roster sync
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '') ILIKE '%profiles%'
    OR coalesce(with_check, '') ILIKE '%profiles%'
  )
  AND policyname IS DISTINCT FROM 'Group class roster sync'
  AND NOT (
    -- Helpers in qual are OK (is_director / assessor_can_read_profile / panel_can_read_profile)
    coalesce(qual, '') ILIKE '%is_director(%'
    OR coalesce(qual, '') ILIKE '%is_assessor(%'
    OR coalesce(qual, '') ILIKE '%is_panel(%'
    OR coalesce(qual, '') ILIKE '%assessor_can_read_profile(%'
    OR coalesce(qual, '') ILIKE '%panel_can_read_profile(%'
    OR coalesce(with_check, '') ILIKE '%is_director(%'
    OR coalesce(with_check, '') ILIKE '%is_assessor(%'
    OR coalesce(with_check, '') ILIKE '%is_panel(%'
  )
ORDER BY tablename, policyname;

-- -----------------------------------------------------------------------------
-- 2) Every Director policy — simple ones should use is_director()
-- -----------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname ILIKE '%director%'
    OR policyname ILIKE 'directors %'
  )
ORDER BY tablename, policyname;

-- Director policies that still look like inline EXISTS on profiles (should be empty
-- except intentionally untouched policies)
SELECT tablename, policyname, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname ILIKE '%director%'
    OR policyname ILIKE 'directors %'
  )
  AND (
    coalesce(qual, '') ~* 'exists\s*\(.*from\s+(public\.)?profiles'
    OR coalesce(with_check, '') ~* 'exists\s*\(.*from\s+(public\.)?profiles'
  )
ORDER BY tablename, policyname;

-- -----------------------------------------------------------------------------
-- 3) Interview policies
-- -----------------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('interview_slots', 'interview_evaluations')
ORDER BY tablename, policyname;

-- Applicant slot join must reference interview_slots.id
SELECT policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'interview_slots'
  AND policyname = 'Applicants can read own interview slot';

-- -----------------------------------------------------------------------------
-- 4) Helper functions: security_definer + owner
-- -----------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_director',
    'is_active_director',
    'is_assessor',
    'is_active_assessor',
    'is_panel',
    'is_active_panel',
    'assessor_can_read_profile',
    'panel_can_read_profile'
  )
ORDER BY p.proname, args;

-- Expected: security_definer = true for all rows above
