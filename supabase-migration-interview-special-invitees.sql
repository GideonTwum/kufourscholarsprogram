-- Forward-only: university special invitees occupy interview_slots without becoming applications.
-- Does NOT rewrite 202610300001 or earlier interview migrations.
-- Does NOT insert fake application rows or change applications.status.
-- Do not apply to production automatically.

CREATE TABLE IF NOT EXISTS public.interview_special_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  university text NOT NULL,
  email text NOT NULL,
  email_normalized text NOT NULL,
  whatsapp_phone text NOT NULL,
  whatsapp_e164 text NOT NULL,
  nationality text NULL,
  programme_of_study text NULL,
  source_type text NOT NULL DEFAULT 'university_invitee',
  interview_slot_id uuid NULL REFERENCES public.interview_slots(id) ON DELETE SET NULL,
  interview_format text NOT NULL DEFAULT 'in_person',
  meeting_link text NULL,
  meeting_instructions text NULL,
  published_at timestamptz NULL,
  invitation_sent_at timestamptz NULL,
  invitation_delivery_status text NULL,
  invitation_last_error text NULL,
  response_status text NULL,
  response_reason text NULL,
  access_token_hash text NULL,
  access_token_expires_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_special_invitees_source_check
    CHECK (source_type = 'university_invitee'),
  CONSTRAINT interview_special_invitees_format_check
    CHECK (interview_format IN ('in_person', 'virtual')),
  CONSTRAINT interview_special_invitees_delivery_check
    CHECK (
      invitation_delivery_status IS NULL
      OR invitation_delivery_status IN ('pending', 'sent', 'failed', 'skipped')
    ),
  CONSTRAINT interview_special_invitees_response_check
    CHECK (
      response_status IS NULL
      OR response_status IN (
        'awaiting_response',
        'attendance_confirmed',
        'virtual_requested',
        'reschedule_requested',
        'unable_to_attend'
      )
    ),
  CONSTRAINT interview_special_invitees_email_key UNIQUE (email_normalized)
);

COMMENT ON TABLE public.interview_special_invitees IS
  'University-recommended interview invitees. Not applications. Share interview_slots capacity with regular applicants.';

CREATE UNIQUE INDEX IF NOT EXISTS interview_special_invitees_whatsapp_key
  ON public.interview_special_invitees (whatsapp_e164);

CREATE INDEX IF NOT EXISTS idx_interview_special_invitees_slot
  ON public.interview_special_invitees (interview_slot_id);

CREATE UNIQUE INDEX IF NOT EXISTS interview_special_invitees_token_hash_key
  ON public.interview_special_invitees (access_token_hash)
  WHERE access_token_hash IS NOT NULL;

ALTER TABLE public.interview_special_invitees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors can manage interview special invitees"
  ON public.interview_special_invitees;
CREATE POLICY "Directors can manage interview special invitees"
  ON public.interview_special_invitees
  FOR ALL
  USING (public.is_director())
  WITH CHECK (public.is_director());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_special_invitees TO authenticated;
GRANT ALL ON public.interview_special_invitees TO service_role;

-- Combined occupancy: regular allocations/applications plus university invitees.
CREATE OR REPLACE FUNCTION public.interview_slot_occupancy(
  p_slot_id uuid,
  p_exclude uuid[] DEFAULT '{}'
)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::integer
  FROM (
    SELECT al.application_id AS occupant_id
    FROM public.application_interview_allocations al
    WHERE al.interview_slot_id = p_slot_id
      AND NOT (al.application_id = ANY (p_exclude))
    UNION
    SELECT a.id
    FROM public.applications a
    WHERE a.interview_slot_id = p_slot_id
      AND NOT (a.id = ANY (p_exclude))
    UNION
    SELECT i.id
    FROM public.interview_special_invitees i
    WHERE i.interview_slot_id = p_slot_id
      AND NOT (i.id = ANY (p_exclude))
  ) occupants;
$$;

CREATE OR REPLACE FUNCTION public.assign_interview_batch_invitees(
  p_slot_id uuid,
  p_invitee_ids uuid[],
  p_actor_id uuid DEFAULT NULL,
  p_interview_format text DEFAULT 'in_person',
  p_allow_move boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_row public.interview_slots%ROWTYPE;
  invitee_id uuid;
  ids uuid[];
  assignable uuid[] := '{}';
  skipped jsonb := '[]'::jsonb;
  booked integer;
  available integer;
  capacity integer;
  current_slot uuid;
  invitee_published timestamptz;
  format_value text;
BEGIN
  IF p_slot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_batch');
  END IF;

  ids := ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_invitee_ids, '{}')) AS x
    WHERE x IS NOT NULL
  );
  IF array_length(ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_selection');
  END IF;

  format_value := CASE WHEN p_interview_format = 'virtual' THEN 'virtual' ELSE 'in_person' END;

  SELECT *
  INTO slot_row
  FROM public.interview_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND OR slot_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_not_found');
  END IF;

  PERFORM 1
  FROM public.interview_special_invitees
  WHERE id = ANY (ids)
  ORDER BY id
  FOR UPDATE;

  FOREACH invitee_id IN ARRAY ids LOOP
    SELECT i.interview_slot_id, i.published_at
    INTO current_slot, invitee_published
    FROM public.interview_special_invitees i
    WHERE i.id = invitee_id;

    IF NOT FOUND THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object('id', invitee_id, 'reason', 'not_found'));
      CONTINUE;
    END IF;

    IF invitee_published IS NOT NULL THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object('id', invitee_id, 'reason', 'published_locked'));
      CONTINUE;
    END IF;

    IF current_slot IS NOT NULL AND current_slot <> p_slot_id AND p_allow_move IS NOT TRUE THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object('id', invitee_id, 'reason', 'already_assigned_other_batch'));
      CONTINUE;
    END IF;

    assignable := array_append(assignable, invitee_id);
  END LOOP;

  capacity := COALESCE(slot_row.capacity, 0);
  booked := public.interview_slot_occupancy(p_slot_id, assignable);
  available := GREATEST(capacity - booked, 0);

  IF COALESCE(array_length(assignable, 1), 0) > available THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_batch_capacity',
      'available', available,
      'needed', COALESCE(array_length(assignable, 1), 0),
      'skipped', skipped
    );
  END IF;

  UPDATE public.interview_special_invitees
  SET
    interview_slot_id = p_slot_id,
    interview_format = format_value,
    updated_at = now()
  WHERE id = ANY (assignable)
    AND published_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'assigned', COALESCE(array_length(assignable, 1), 0),
    'skipped', skipped,
    'available', available - COALESCE(array_length(assignable, 1), 0),
    'notify_applicants', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_interview_batch_invitees(uuid, uuid[], uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_interview_batch_invitees(uuid, uuid[], uuid, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.interview_slot_occupancy(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.interview_slot_occupancy(uuid, uuid[]) TO authenticated;
