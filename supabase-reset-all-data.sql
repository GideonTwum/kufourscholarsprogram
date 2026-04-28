-- =============================================================================
-- Kufuor Scholars — FULL RESET so you can start creating accounts/content again
-- Run once in Supabase → SQL Editor. IRREVERSIBLE. Prefer dev branch first.
--
-- Clears Auth + profile-linked rows (cascade) + public content tables +
-- orphaned messaging / email_logs. Leaves site_settings (deadlines toggles).
-- Empty Storage buckets manually if you uploaded files.
-- =============================================================================

begin;

-- Does not CASCADE when the director profile row is deleted
update public.requests
set responded_by = null
where responded_by is not null;

-- Not linked to Auth
truncate table public.panel_members restart identity;

-- Deletes every signup. Cascades drop dependent rows tied to profiles (applications,
-- notifications, announcements, interview_slots, interview_evaluations, directors, …)
delete from auth.users;

-- Survived because of ON DELETE SET NULL or no FK — remove explicitly.
truncate table public.email_logs restart identity cascade;

truncate table public.messages restart identity cascade;
truncate table public.conversation_members restart identity cascade;
truncate table public.conversations restart identity cascade;
truncate table public.requests restart identity cascade;

truncate table public.projects restart identity cascade;
truncate table public.events restart identity cascade;
truncate table public.scholars restart identity cascade;
truncate table public.news_articles restart identity cascade;
truncate table public.youtube_spotlights restart identity cascade;
truncate table public.scholar_videos restart identity cascade;
truncate table public.mentors restart identity cascade;
truncate table public.teams restart identity cascade;

commit;
