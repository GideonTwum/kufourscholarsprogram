-- Director Communications attachments (additive).
-- Private storage for temporary campaign files + metadata on director_communications.
-- Does NOT change applications, interview assignments, or make objects public.

ALTER TABLE public.director_communications
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.director_communications.attachments IS
  'Metadata for private director-communications storage objects used by this campaign. Never stores file bytes or service-role secrets.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('director-communications', 'director-communications', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

-- No authenticated Storage policies: only service_role / Admin client writes and signs URLs.
-- Directors never receive permanent public URLs.

DROP POLICY IF EXISTS "No public read director-communications" ON storage.objects;
-- Intentionally no SELECT/INSERT policies for authenticated users on this bucket.
