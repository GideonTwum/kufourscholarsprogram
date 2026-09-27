-- Director → applicant communications (additive).
-- Communication campaign status is independent of applications.status.
-- Recipient emails are resolved server-side; RLS is Director-read only.
-- Writes use service_role / Admin client (same pattern as director_audit_events).

CREATE TABLE IF NOT EXISTS public.director_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name_snapshot text,
  created_by_email_snapshot text,
  audience_type text NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'partial_failure', 'failed')),
  recipient_count integer NOT NULL DEFAULT 0,
  successful_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  excluded_count integer NOT NULL DEFAULT 0,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_director_communications_created_at
  ON public.director_communications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_director_communications_created_by
  ON public.director_communications (created_by);

CREATE TABLE IF NOT EXISTS public.director_communication_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.director_communications(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name_snapshot text,
  university_snapshot text,
  status_snapshot text,
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_code text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_director_comm_recipients_comm
  ON public.director_communication_recipients (communication_id);

CREATE INDEX IF NOT EXISTS idx_director_comm_recipients_pending
  ON public.director_communication_recipients (communication_id, delivery_status);

ALTER TABLE public.director_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_communication_recipients ENABLE ROW LEVEL SECURITY;

-- Directors may read communication history; inserts/updates via service_role Admin API only.
DROP POLICY IF EXISTS "Directors read communications" ON public.director_communications;
CREATE POLICY "Directors read communications" ON public.director_communications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'director'
        AND COALESCE(p.is_active, true) = true
    )
  );

DROP POLICY IF EXISTS "Directors read communication recipients" ON public.director_communication_recipients;
CREATE POLICY "Directors read communication recipients" ON public.director_communication_recipients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'director'
        AND COALESCE(p.is_active, true) = true
    )
  );

COMMENT ON TABLE public.director_communications IS
  'Director email campaigns to applicants. Status is campaign-level only — never applications.status.';

COMMENT ON TABLE public.director_communication_recipients IS
  'Per-recipient delivery rows for director_communications. Emails sent individually for privacy.';
