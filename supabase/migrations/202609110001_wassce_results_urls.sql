-- Additive Stage 1 WASSCE / NovDec results documents (multi-path jsonb array).
-- Nullable/default-safe for historical applications submitted before this requirement.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS wassce_results_urls jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.applications.wassce_results_urls IS
  'JSON array of private applications-bucket storage paths for WASSCE and/or NovDec results documents. Required for new Stage 1 submissions after this column existed. Historical rows may be empty.';
