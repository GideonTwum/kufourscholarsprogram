-- Mirror of supabase/migrations/202611130001_director_communication_attachments.sql
-- Apply manually in Supabase when ready. Not applied by the agent.

ALTER TABLE public.director_communications
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.director_communications.attachments IS
  'Metadata for private director-communications storage objects used by this campaign. Never stores file bytes or service-role secrets.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('director-communications', 'director-communications', false)
ON CONFLICT (id) DO UPDATE
SET public = false;
