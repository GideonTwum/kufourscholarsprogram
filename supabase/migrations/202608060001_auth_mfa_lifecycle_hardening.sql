-- Protect privileged profile lifecycle columns from client/JWT updates.
-- Only service_role (Admin client) may change these fields.
-- Depends on: 202608030001 (protect_profile_privileged_columns), 202608040001+ lifecycle columns.
-- Apply after: 202608050001_interview_queue_batch_workflow.sql

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server paths use the service role (staff create / deactivate / scripts).
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing profile role is not allowed';
  END IF;

  IF NEW.class_name IS DISTINCT FROM OLD.class_name THEN
    RAISE EXCEPTION 'Changing class_name is not allowed';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Changing is_active is not allowed';
  END IF;

  IF NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at THEN
    RAISE EXCEPTION 'Changing deactivated_at is not allowed';
  END IF;

  IF NEW.deactivated_by IS DISTINCT FROM OLD.deactivated_by THEN
    RAISE EXCEPTION 'Changing deactivated_by is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_profile_privileged_columns();

COMMENT ON FUNCTION public.protect_profile_privileged_columns() IS
  'Blocks JWT clients from changing role, class_name, is_active, deactivated_at, deactivated_by. service_role only.';
