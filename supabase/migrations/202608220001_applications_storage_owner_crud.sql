-- Applicant CRUD policies for private `applications` storage bucket.
--
-- Root cause of production "new row violates row-level security policy" on Stage 1 uploads:
-- Browser uploads use storage.upload(..., { upsert: true }). Supabase Storage upsert requires
-- INSERT + SELECT + UPDATE on storage.objects. Historical migrations only created INSERT and
-- SELECT for applicants ("Users can upload to own folder" / "Users can read own uploads").
--
-- Object path convention (unchanged):
--   {auth.uid()}/{folder}/...filename
-- First path segment must equal auth.uid()::text.
--
-- Does NOT make the bucket public.
-- Does NOT use WITH CHECK (true).
-- Does NOT grant cross-applicant access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('applications', 'applications', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Ensure applicant INSERT (own namespace)
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Users can upload to own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Ensure applicant SELECT (own namespace) — also required for INSERT … RETURNING / upsert
DROP POLICY IF EXISTS "Users can read own uploads" ON storage.objects;
CREATE POLICY "Users can read own uploads"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Required for upsert / replace of own objects
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
CREATE POLICY "Users can update own uploads"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Required to remove own objects from storage
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;
CREATE POLICY "Users can delete own uploads"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'applications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
