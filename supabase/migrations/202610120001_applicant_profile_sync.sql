-- Applicant profile consistency.
-- 1) When Auth finishes an email change, copy the confirmed address onto
--    profiles.email in the same database transaction. Pending email_change
--    values are ignored. Repeating the update is a no-op.
-- 2) Application identity edits for one user commit together with the
--    matching profile name/phone and the applicant audit row.
--
-- Does not change signup confirmation, account recovery, or RLS.
-- Apply manually. Do not run against production from the app deploy alone.

CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;

  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.email_change, '') <> '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id
    AND email IS DISTINCT FROM NEW.email;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    INSERT INTO public.director_audit_events (
      actor_id,
      actor_email_snapshot,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value,
      metadata
    )
    VALUES (
      NEW.id,
      NEW.email,
      'applicant.email_verified',
      'profile',
      NEW.id::text,
      jsonb_build_object('email', OLD.email),
      jsonb_build_object('email', NEW.email),
      jsonb_build_object('actor_type', 'applicant', 'source', 'auth_email_trigger')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_from_auth ON auth.users;
CREATE TRIGGER trg_sync_profile_email_from_auth
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_profile_email_from_auth();

COMMENT ON FUNCTION public.sync_profile_email_from_auth() IS
  'Copies a confirmed Auth email onto profiles.email. Skips pending email changes.';

CREATE OR REPLACE FUNCTION public.apply_applicant_profile_correction(
  p_user_id uuid,
  p_patch jsonb,
  p_base_updated_at timestamptz,
  p_actor_name text,
  p_actor_email text,
  p_old jsonb,
  p_new jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[] := ARRAY[
    'full_name', 'date_of_birth', 'gender', 'hometown', 'phone', 'university', 'program'
  ];
  key text;
  rec record;
  latest_at timestamptz;
  app_ids uuid[] := '{}';
  app_count integer := 0;
BEGIN
  IF COALESCE(auth.role(), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'invalid_patch';
  END IF;

  FOR key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF NOT (key = ANY (allowed)) THEN
      RAISE EXCEPTION 'unknown_field';
    END IF;
  END LOOP;

  FOR rec IN
    SELECT id, updated_at
    FROM public.applications
    WHERE user_id = p_user_id
    ORDER BY updated_at DESC
    FOR UPDATE
  LOOP
    app_count := app_count + 1;
    app_ids := app_ids || rec.id;
    IF latest_at IS NULL THEN
      latest_at := rec.updated_at;
    END IF;
  END LOOP;

  IF app_count > 0 AND (p_base_updated_at IS NULL OR latest_at IS DISTINCT FROM p_base_updated_at) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  UPDATE public.applications
  SET
    full_name = CASE WHEN p_patch ? 'full_name' THEN p_patch->>'full_name' ELSE full_name END,
    date_of_birth = CASE
      WHEN p_patch ? 'date_of_birth' THEN (p_patch->>'date_of_birth')::date
      ELSE date_of_birth
    END,
    gender = CASE WHEN p_patch ? 'gender' THEN p_patch->>'gender' ELSE gender END,
    hometown = CASE WHEN p_patch ? 'hometown' THEN p_patch->>'hometown' ELSE hometown END,
    phone = CASE WHEN p_patch ? 'phone' THEN p_patch->>'phone' ELSE phone END,
    university = CASE WHEN p_patch ? 'university' THEN p_patch->>'university' ELSE university END,
    program = CASE WHEN p_patch ? 'program' THEN p_patch->>'program' ELSE program END,
    updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE public.profiles
  SET
    full_name = CASE WHEN p_patch ? 'full_name' THEN p_patch->>'full_name' ELSE full_name END,
    phone = CASE WHEN p_patch ? 'phone' THEN p_patch->>'phone' ELSE phone END
  WHERE id = p_user_id
    AND (p_patch ? 'full_name' OR p_patch ? 'phone');

  INSERT INTO public.director_audit_events (
    actor_id,
    actor_name_snapshot,
    actor_email_snapshot,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    metadata
  )
  VALUES (
    p_user_id,
    p_actor_name,
    p_actor_email,
    'applicant.profile_updated',
    CASE WHEN app_count > 0 THEN 'application' ELSE 'profile' END,
    COALESCE(app_ids[1]::text, p_user_id::text),
    p_old,
    p_new,
    jsonb_build_object(
      'actor_type', 'applicant',
      'application_ids', to_jsonb(app_ids)
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_applicant_profile_correction(uuid, jsonb, timestamptz, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_applicant_profile_correction(uuid, jsonb, timestamptz, text, text, jsonb, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.apply_applicant_profile_correction(uuid, jsonb, timestamptz, text, text, jsonb, jsonb) IS
  'Atomically updates one applicant''s application identity rows, profile name/phone, and audit event.';
