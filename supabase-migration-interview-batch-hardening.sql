-- Forward-only: transactional batch assignment, invitation delivery status, reschedule records.
-- Does NOT rewrite 202610300001 or earlier pending interview migrations.
-- Does NOT change applications.status except through the reschedule RPC for already-published rows' slot/date/time.
-- Does NOT send email. Do not apply to production automatically.

ALTER TABLE public.application_interview_allocations
  ADD COLUMN IF NOT EXISTS invitation_delivery_status text,
  ADD COLUMN IF NOT EXISTS invitation_last_error text;

ALTER TABLE public.application_interview_allocations
  DROP CONSTRAINT IF EXISTS application_interview_allocations_delivery_check;
ALTER TABLE public.application_interview_allocations
  ADD CONSTRAINT application_interview_allocations_delivery_check
  CHECK (
    invitation_delivery_status IS NULL
    OR invitation_delivery_status IN ('pending', 'sent', 'failed', 'skipped')
  );

ALTER TABLE public.application_interview_requests
  ADD COLUMN IF NOT EXISTS previous_interview_date date,
  ADD COLUMN IF NOT EXISTS previous_interview_time text,
  ADD COLUMN IF NOT EXISTS new_interview_date date,
  ADD COLUMN IF NOT EXISTS new_interview_time text,
  ADD COLUMN IF NOT EXISTS notification_status text,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_last_error text;

ALTER TABLE public.application_interview_requests
  DROP CONSTRAINT IF EXISTS application_interview_requests_notification_check;
ALTER TABLE public.application_interview_requests
  ADD CONSTRAINT application_interview_requests_notification_check
  CHECK (
    notification_status IS NULL
    OR notification_status IN ('pending', 'sent', 'failed', 'not_required')
  );

-- Legacy live assignments were emailed before delivery columns existed. Do not re-invite.
UPDATE public.application_interview_allocations
SET
  invitation_delivery_status = COALESCE(invitation_delivery_status, 'sent'),
  invitation_sent_at = COALESCE(invitation_sent_at, published_at)
WHERE published_at IS NOT NULL
  AND invitation_sent_at IS NULL;

UPDATE public.interview_slots s
SET invitation_sent_at = COALESCE(s.invitation_sent_at, s.published_at, s.updated_at)
WHERE s.invitation_sent_at IS NULL
  AND (
    s.published_at IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.interview_slot_id = s.id
        AND a.status IN ('called_for_interview', 'interview')
    )
  );

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
    SELECT al.application_id AS applicant_id
    FROM public.application_interview_allocations al
    WHERE al.interview_slot_id = p_slot_id
      AND NOT (al.application_id = ANY (p_exclude))
    UNION
    SELECT a.id
    FROM public.applications a
    WHERE a.interview_slot_id = p_slot_id
      AND NOT (a.id = ANY (p_exclude))
  ) occupants;
$$;

CREATE OR REPLACE FUNCTION public.assign_interview_batch_applicants(
  p_slot_id uuid,
  p_application_ids uuid[],
  p_actor_id uuid DEFAULT NULL,
  p_interview_format text DEFAULT 'in_person'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot_row public.interview_slots%ROWTYPE;
  app_id uuid;
  ids uuid[];
  assignable uuid[] := '{}';
  skipped jsonb := '[]'::jsonb;
  booked integer;
  available integer;
  capacity integer;
  published_slot uuid;
  allocation_published timestamptz;
  format_value text;
BEGIN
  IF p_slot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_batch');
  END IF;

  ids := ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_application_ids, '{}')) AS x
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
  IF slot_row.published_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_already_published');
  END IF;

  PERFORM 1
  FROM public.applications
  WHERE id = ANY (ids)
  ORDER BY id
  FOR UPDATE;

  PERFORM 1
  FROM public.application_interview_allocations
  WHERE application_id = ANY (ids)
  ORDER BY application_id
  FOR UPDATE;

  FOREACH app_id IN ARRAY ids LOOP
    SELECT a.interview_slot_id
    INTO published_slot
    FROM public.applications a
    WHERE a.id = app_id;

    SELECT al.published_at
    INTO allocation_published
    FROM public.application_interview_allocations al
    WHERE al.application_id = app_id;

    IF allocation_published IS NOT NULL THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object('id', app_id, 'reason', 'published_locked'));
      CONTINUE;
    END IF;

    IF published_slot IS NOT NULL AND published_slot <> p_slot_id THEN
      skipped := skipped || jsonb_build_array(jsonb_build_object('id', app_id, 'reason', 'already_on_published_batch'));
      CONTINUE;
    END IF;

    assignable := array_append(assignable, app_id);
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

  FOREACH app_id IN ARRAY assignable LOOP
    INSERT INTO public.application_interview_allocations (
      application_id,
      allocation_state,
      interview_slot_id,
      schedule_day_id,
      interview_format,
      allocated_by,
      published_at,
      invitation_sent_at,
      invitation_delivery_status,
      invitation_last_error,
      response_status,
      updated_at
    )
    VALUES (
      app_id,
      'physical',
      p_slot_id,
      slot_row.schedule_day_id,
      format_value,
      p_actor_id,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      now()
    )
    ON CONFLICT (application_id) DO UPDATE
    SET
      allocation_state = 'physical',
      interview_slot_id = EXCLUDED.interview_slot_id,
      schedule_day_id = EXCLUDED.schedule_day_id,
      interview_format = EXCLUDED.interview_format,
      allocated_by = EXCLUDED.allocated_by,
      published_at = NULL,
      invitation_sent_at = NULL,
      invitation_delivery_status = NULL,
      invitation_last_error = NULL,
      response_status = NULL,
      updated_at = now()
    WHERE public.application_interview_allocations.published_at IS NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'assigned', COALESCE(array_length(assignable, 1), 0),
    'skipped', skipped,
    'available', available - COALESCE(array_length(assignable, 1), 0),
    'notify_applicants', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_interview_batch_assignment(
  p_request_id uuid,
  p_replacement_slot_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_director_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.application_interview_requests%ROWTYPE;
  current_slot public.interview_slots%ROWTYPE;
  next_slot public.interview_slots%ROWTYPE;
  first_slot uuid;
  second_slot uuid;
  booked integer;
  available integer;
  previous_date date;
  previous_time text;
BEGIN
  SELECT *
  INTO req
  FROM public.application_interview_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;
  IF req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_already_decided');
  END IF;
  IF req.request_type <> 'reschedule' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_reschedule');
  END IF;
  IF p_replacement_slot_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'replacement_interview_slot_id required');
  END IF;

  SELECT s.*
  INTO current_slot
  FROM public.applications a
  JOIN public.interview_slots s ON s.id = a.interview_slot_id
  WHERE a.id = req.application_id;

  IF current_slot.id IS NULL THEN
    SELECT s.*
    INTO current_slot
    FROM public.application_interview_allocations al
    JOIN public.interview_slots s ON s.id = al.interview_slot_id
    WHERE al.application_id = req.application_id;
  END IF;

  IF current_slot.id IS NOT NULL AND current_slot.id = p_replacement_slot_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'replacement_same_as_current');
  END IF;

  first_slot := CASE
    WHEN current_slot.id IS NULL OR current_slot.id < p_replacement_slot_id THEN COALESCE(current_slot.id, p_replacement_slot_id)
    ELSE p_replacement_slot_id
  END;
  second_slot := CASE
    WHEN current_slot.id IS NULL OR current_slot.id = p_replacement_slot_id THEN NULL
    WHEN current_slot.id < p_replacement_slot_id THEN p_replacement_slot_id
    ELSE current_slot.id
  END;

  PERFORM 1 FROM public.interview_slots WHERE id = first_slot FOR UPDATE;
  IF second_slot IS NOT NULL THEN
    PERFORM 1 FROM public.interview_slots WHERE id = second_slot FOR UPDATE;
  END IF;
  PERFORM 1 FROM public.applications WHERE id = req.application_id FOR UPDATE;
  PERFORM 1 FROM public.application_interview_allocations WHERE application_id = req.application_id FOR UPDATE;

  SELECT *
  INTO next_slot
  FROM public.interview_slots
  WHERE id = p_replacement_slot_id;

  IF next_slot.id IS NULL OR next_slot.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'replacement_not_found');
  END IF;

  booked := public.interview_slot_occupancy(p_replacement_slot_id, ARRAY[req.application_id]);
  available := GREATEST(COALESCE(next_slot.capacity, 0) - booked, 0);
  IF COALESCE(next_slot.capacity, 0) > 0 AND available < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_full', 'available', available);
  END IF;

  previous_date := current_slot.interview_date;
  previous_time := CASE
    WHEN current_slot.end_time IS NOT NULL THEN current_slot.interview_time || '–' || current_slot.end_time || ' GMT'
    ELSE current_slot.interview_time
  END;

  UPDATE public.application_interview_allocations
  SET
    interview_slot_id = next_slot.id,
    schedule_day_id = next_slot.schedule_day_id,
    response_status = 'awaiting_response',
    invitation_delivery_status = CASE
      WHEN published_at IS NOT NULL THEN 'pending'
      ELSE invitation_delivery_status
    END,
    invitation_sent_at = CASE
      WHEN published_at IS NOT NULL THEN NULL
      ELSE invitation_sent_at
    END,
    invitation_last_error = NULL,
    updated_at = now()
  WHERE application_id = req.application_id;

  UPDATE public.applications
  SET
    interview_slot_id = next_slot.id,
    interview_date = next_slot.interview_date,
    interview_time = CASE
      WHEN next_slot.end_time IS NOT NULL THEN next_slot.interview_time || '–' || next_slot.end_time || ' GMT'
      ELSE next_slot.interview_time
    END,
    interview_location = next_slot.location,
    updated_at = now()
  WHERE id = req.application_id
    AND status IN ('called_for_interview', 'interview');

  UPDATE public.application_interview_requests
  SET
    status = 'approved',
    decided_by = p_actor_id,
    decided_at = now(),
    director_notes = COALESCE(p_director_notes, director_notes),
    current_interview_slot_id = current_slot.id,
    replacement_interview_slot_id = next_slot.id,
    previous_interview_date = previous_date,
    previous_interview_time = previous_time,
    new_interview_date = next_slot.interview_date,
    new_interview_time = CASE
      WHEN next_slot.end_time IS NOT NULL THEN next_slot.interview_time || '–' || next_slot.end_time || ' GMT'
      ELSE next_slot.interview_time
    END,
    notification_status = 'pending',
    notification_sent_at = NULL,
    notification_last_error = NULL,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', p_request_id,
    'application_id', req.application_id,
    'previous', jsonb_build_object(
      'slot_id', current_slot.id,
      'date', previous_date,
      'time', previous_time
    ),
    'next', jsonb_build_object(
      'slot_id', next_slot.id,
      'date', next_slot.interview_date,
      'time', CASE
        WHEN next_slot.end_time IS NOT NULL THEN next_slot.interview_time || '–' || next_slot.end_time || ' GMT'
        ELSE next_slot.interview_time
      END,
      'location', next_slot.location,
      'batch_name', next_slot.batch_name
    ),
    'notification_status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.interview_slot_occupancy(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_interview_batch_applicants(uuid, uuid[], uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_interview_batch_assignment(uuid, uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.interview_slot_occupancy(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_interview_batch_applicants(uuid, uuid[], uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_interview_batch_assignment(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.interview_slot_occupancy(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_interview_batch_applicants(uuid, uuid[], uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_interview_batch_assignment(uuid, uuid, uuid, text) TO authenticated;
