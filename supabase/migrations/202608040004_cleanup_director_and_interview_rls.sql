-- =============================================================================
-- Cleanup: Director + interview RLS (capture production manual fixes)
-- Idempotent. Apply AFTER: 202608040003_profiles_self_read_rls.sql
--
-- Purpose:
--   - Remove recursive Director RLS (inline EXISTS on profiles)
--   - Standardize Director policies on public.is_director()
--   - Move assessor/panel profile visibility into SECURITY DEFINER helpers
--   - Fix interview slot applicant visibility join
--   - Align panel interview evaluation visibility statuses
--
-- Does NOT weaken RLS. Does NOT touch "Group class roster sync".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Role helpers (SECURITY DEFINER — bypass RLS when checking own role)
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

-- Cross-table profile visibility (SECURITY DEFINER avoids profiles↔applications RLS cycle)
-- Parameter name must stay target_profile_id — CREATE OR REPLACE cannot rename args (42P13).
CREATE OR REPLACE FUNCTION public.assessor_can_read_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_active_assessor()
    AND (
      target_profile_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.applications a
        JOIN public.assessor_assignments aa ON aa.application_id = a.id
        WHERE aa.assessor_id = auth.uid()
          AND aa.status = 'active'
          AND a.user_id = target_profile_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.panel_can_read_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_active_panel()
    AND (
      target_profile_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.applications a
        WHERE a.user_id = target_profile_id
          AND a.status IN (
            'called_for_interview',
            'interview',
            'interview_review_pending'
          )
      )
    );
$$;

-- Helper grants
GRANT EXECUTE ON FUNCTION public.is_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assessor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_assessor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_panel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_panel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assessor_can_read_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.panel_can_read_profile(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Profiles grants + RLS
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Directors can read all profiles" ON public.profiles;
CREATE POLICY "Directors can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_director());

DROP POLICY IF EXISTS "Directors can update any profile" ON public.profiles;
CREATE POLICY "Directors can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (public.is_director())
  WITH CHECK (public.is_director());

DROP POLICY IF EXISTS "Authenticated can read director profiles" ON public.profiles;
CREATE POLICY "Authenticated can read director profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND role = 'director');

DROP POLICY IF EXISTS "Assessors can read assigned applicant profiles" ON public.profiles;
CREATE POLICY "Assessors can read assigned applicant profiles"
  ON public.profiles
  FOR SELECT
  USING (public.assessor_can_read_profile(id));

DROP POLICY IF EXISTS "Panel can read applicant profiles" ON public.profiles;
CREATE POLICY "Panel can read applicant profiles"
  ON public.profiles
  FOR SELECT
  USING (public.panel_can_read_profile(id));

-- ---------------------------------------------------------------------------
-- 3) Assessor assignments
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.assessor_assignments') IS NULL THEN
    RETURN;
  END IF;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assessor_assignments TO authenticated;

  DROP POLICY IF EXISTS "directors can manage assessor assignments" ON public.assessor_assignments;
  DROP POLICY IF EXISTS "Directors can manage assessor assignments" ON public.assessor_assignments;
  CREATE POLICY "Directors can manage assessor assignments"
    ON public.assessor_assignments
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- ---------------------------------------------------------------------------
-- 4) Replace legacy Director inline EXISTS(...profiles...) policies
--     (skip conversation_members "Group class roster sync" entirely)
-- ---------------------------------------------------------------------------

-- announcements
DO $$
BEGIN
  IF to_regclass('public.announcements') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage announcements" ON public.announcements;
  CREATE POLICY "Directors can manage announcements"
    ON public.announcements
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- conversations
DO $$
BEGIN
  IF to_regclass('public.conversations') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can view all conversations" ON public.conversations;
  CREATE POLICY "Directors can view all conversations"
    ON public.conversations
    FOR SELECT
    USING (public.is_director());
END $$;

-- conversation_members — ONLY "Directors can view all members"
DO $$
BEGIN
  IF to_regclass('public.conversation_members') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can view all members" ON public.conversation_members;
  CREATE POLICY "Directors can view all members"
    ON public.conversation_members
    FOR SELECT
    USING (public.is_director());
  -- Intentionally leave "Group class roster sync" unchanged
END $$;

-- director_audit_events
DO $$
BEGIN
  IF to_regclass('public.director_audit_events') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Active directors can read audit events" ON public.director_audit_events;
  DROP POLICY IF EXISTS "Directors can read audit events" ON public.director_audit_events;
  CREATE POLICY "Active directors can read audit events"
    ON public.director_audit_events
    FOR SELECT
    USING (public.is_director());
END $$;

-- events
DO $$
BEGIN
  IF to_regclass('public.events') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage events" ON public.events;
  CREATE POLICY "Directors can manage events"
    ON public.events
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- mentors
DO $$
BEGIN
  IF to_regclass('public.mentors') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage mentors" ON public.mentors;
  CREATE POLICY "Directors can manage mentors"
    ON public.mentors
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- messages
DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can view all messages" ON public.messages;
  CREATE POLICY "Directors can view all messages"
    ON public.messages
    FOR SELECT
    USING (public.is_director());
END $$;

-- news_articles
DO $$
BEGIN
  IF to_regclass('public.news_articles') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage news_articles" ON public.news_articles;
  CREATE POLICY "Directors can manage news_articles"
    ON public.news_articles
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- projects
DO $$
BEGIN
  IF to_regclass('public.projects') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage projects" ON public.projects;
  CREATE POLICY "Directors can manage projects"
    ON public.projects
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- requests
DO $$
BEGIN
  IF to_regclass('public.requests') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can read all requests" ON public.requests;
  CREATE POLICY "Directors can read all requests"
    ON public.requests
    FOR SELECT
    USING (public.is_director());

  DROP POLICY IF EXISTS "Directors can update requests" ON public.requests;
  CREATE POLICY "Directors can update requests"
    ON public.requests
    FOR UPDATE
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- scholar_videos
DO $$
BEGIN
  IF to_regclass('public.scholar_videos') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage scholar videos" ON public.scholar_videos;
  CREATE POLICY "Directors can manage scholar videos"
    ON public.scholar_videos
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- scholars
DO $$
BEGIN
  IF to_regclass('public.scholars') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage scholars" ON public.scholars;
  CREATE POLICY "Directors can manage scholars"
    ON public.scholars
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- teams
DO $$
BEGIN
  IF to_regclass('public.teams') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage teams" ON public.teams;
  CREATE POLICY "Directors can manage teams"
    ON public.teams
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- youtube_spotlights
DO $$
BEGIN
  IF to_regclass('public.youtube_spotlights') IS NULL THEN RETURN; END IF;
  DROP POLICY IF EXISTS "Directors can manage youtube spotlights" ON public.youtube_spotlights;
  CREATE POLICY "Directors can manage youtube spotlights"
    ON public.youtube_spotlights
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());
END $$;

-- ---------------------------------------------------------------------------
-- 5) Interview evaluations
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.interview_evaluations') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Directors can manage interview_evaluations" ON public.interview_evaluations;
  CREATE POLICY "Directors can manage interview_evaluations"
    ON public.interview_evaluations
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());

  -- Remove redundant read-only Director policy
  DROP POLICY IF EXISTS "Directors can read interview_evaluations" ON public.interview_evaluations;

  DROP POLICY IF EXISTS "Panel can read evaluations for interview apps" ON public.interview_evaluations;
  CREATE POLICY "Panel can read evaluations for interview apps"
    ON public.interview_evaluations
    FOR SELECT
    USING (
      public.is_panel()
      AND EXISTS (
        SELECT 1
        FROM public.applications a
        WHERE a.id = interview_evaluations.application_id
          AND a.status IN (
            'called_for_interview',
            'interview',
            'interview_review_pending'
          )
      )
    );
END $$;

-- ---------------------------------------------------------------------------
-- 6) Interview slots
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.interview_slots') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Directors can manage interview slots" ON public.interview_slots;
  CREATE POLICY "Directors can manage interview slots"
    ON public.interview_slots
    FOR ALL
    USING (public.is_director())
    WITH CHECK (public.is_director());

  -- Fix applicant visibility: join slot id correctly (not a.interview_slot_id = a.id)
  DROP POLICY IF EXISTS "Applicants can read own interview slot" ON public.interview_slots;
  CREATE POLICY "Applicants can read own interview slot"
    ON public.interview_slots
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.applications a
        WHERE a.interview_slot_id = interview_slots.id
          AND a.user_id = auth.uid()
      )
    );
END $$;

-- ---------------------------------------------------------------------------
-- 7) Reload PostgREST schema cache
-- ---------------------------------------------------------------------------
COMMIT;
NOTIFY pgrst, 'reload schema';
