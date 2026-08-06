-- VERIFY-EMPTY-TEST-DATABASE.sql
-- Run in Supabase SQL Editor after scripts/reset-test-data.mjs --execute
-- Do not commit real emails. Replace the placeholder before running director checks.

-- 1) Workflow tables should be empty (0)
SELECT 'applications' AS table_name, count(*)::int AS n FROM public.applications
UNION ALL SELECT 'assessor_assignments', count(*)::int FROM public.assessor_assignments
UNION ALL SELECT 'application_assessments', count(*)::int FROM public.application_assessments
UNION ALL SELECT 'interview_evaluations', count(*)::int FROM public.interview_evaluations
UNION ALL SELECT 'interview_slots', count(*)::int FROM public.interview_slots
UNION ALL SELECT 'notifications', count(*)::int FROM public.notifications
UNION ALL SELECT 'email_logs', count(*)::int FROM public.email_logs
UNION ALL SELECT 'announcements', count(*)::int FROM public.announcements
UNION ALL SELECT 'conversations', count(*)::int FROM public.conversations
UNION ALL SELECT 'conversation_members', count(*)::int FROM public.conversation_members
UNION ALL SELECT 'messages', count(*)::int FROM public.messages
UNION ALL SELECT 'panel_members', count(*)::int FROM public.panel_members
UNION ALL SELECT 'requests', count(*)::int FROM public.requests
ORDER BY 1;

-- 2) No applicant/scholar profiles remain
SELECT role, count(*)::int
FROM public.profiles
GROUP BY role
ORDER BY 1;

-- Expect: role applicant/scholar = 0 (unless you intentionally kept data)

-- 3) At least one active Director remains
SELECT id, email, is_active
FROM public.profiles
WHERE role = 'director' AND is_active IS DISTINCT FROM false;

-- Optional: confirm preserved email (replace placeholder)
-- SELECT id, email, role, is_active
-- FROM public.profiles
-- WHERE lower(email) = lower('REPLACE_WITH_PRESERVED_DIRECTOR_EMAIL');

-- 4) site_settings still present
SELECT count(*)::int AS site_settings_rows FROM public.site_settings;

-- 5) Public CMS tables untouched (counts for awareness — not required to be non-zero)
SELECT 'news_articles' AS t, count(*)::int FROM public.news_articles
UNION ALL SELECT 'events', count(*)::int FROM public.events
UNION ALL SELECT 'projects', count(*)::int FROM public.projects
UNION ALL SELECT 'mentors', count(*)::int FROM public.mentors
UNION ALL SELECT 'teams', count(*)::int FROM public.teams;

-- 6) RLS still enabled on key tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles', 'applications', 'assessor_assignments', 'application_assessments',
    'interview_slots', 'interview_evaluations'
  )
ORDER BY 1;

-- 7) Helper functions still exist
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_director', 'is_active_director', 'is_assessor', 'is_active_assessor',
    'is_panel', 'is_active_panel', 'protect_profile_privileged_columns'
  )
ORDER BY 1;

-- 8) Migration history untouched (supabase_migrations if present)
SELECT count(*)::int AS migration_rows
FROM information_schema.tables
WHERE table_schema = 'supabase_migrations' OR table_name = 'schema_migrations';

-- Prefer:
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
