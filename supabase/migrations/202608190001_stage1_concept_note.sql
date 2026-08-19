-- Stage 1 One-Page Concept Note fields
-- Nullable for backward compatibility with historical applications.
-- New submissions enforce title + PDF at application-validation / submit-stage1.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS concept_note_title text;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS concept_note_path text;

COMMENT ON COLUMN public.applications.concept_note_title IS
  'Stage 1 one-page Concept Note title (required for new submissions).';

COMMENT ON COLUMN public.applications.concept_note_path IS
  'Storage path in applications bucket for Concept Note PDF (required for new submissions).';
