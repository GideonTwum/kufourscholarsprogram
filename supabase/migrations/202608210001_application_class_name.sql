-- Application Class terminology (replaces user-facing "cohort").
-- site_settings.application_class_name is the recruiting Class source of truth.
-- applications.application_class_name persists Class at intake (historical safety).
-- Legacy application_cohort_year remains for compatibility but is deprecated.

INSERT INTO public.site_settings (key, value)
VALUES ('application_class_name', '11th Class')
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(NULLIF(btrim(public.site_settings.value), ''), EXCLUDED.value);

COMMENT ON TABLE public.site_settings IS
  'Site-wide settings. Prefer application_class_name for recruiting Class. application_cohort_year is legacy/deprecated.';

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_class_name text;

COMMENT ON COLUMN public.applications.application_class_name IS
  'Recruiting Class at application creation (e.g. 11th Class). Persisted so changing the global setting does not relabel historical applications. Null only for legacy rows created before this column.';

-- Stamp Class on new application rows from current setting when blank.
CREATE OR REPLACE FUNCTION public.stamp_application_class_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_class text;
BEGIN
  IF NEW.application_class_name IS NULL OR btrim(NEW.application_class_name) = '' THEN
    SELECT NULLIF(btrim(value), '')
      INTO current_class
      FROM public.site_settings
     WHERE key = 'application_class_name'
     LIMIT 1;
    IF current_class IS NOT NULL THEN
      NEW.application_class_name := current_class;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_application_class_name ON public.applications;
CREATE TRIGGER trg_stamp_application_class_name
  BEFORE INSERT ON public.applications
  FOR EACH ROW
  EXECUTE PROCEDURE public.stamp_application_class_name();

-- Also stamp on UPDATE when still blank (e.g. first draft save path edge cases).
CREATE OR REPLACE FUNCTION public.stamp_application_class_name_on_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_class text;
BEGIN
  IF (NEW.application_class_name IS NULL OR btrim(NEW.application_class_name) = '')
     AND (OLD.application_class_name IS NULL OR btrim(OLD.application_class_name) = '') THEN
    SELECT NULLIF(btrim(value), '')
      INTO current_class
      FROM public.site_settings
     WHERE key = 'application_class_name'
     LIMIT 1;
    IF current_class IS NOT NULL THEN
      NEW.application_class_name := current_class;
    END IF;
  ELSIF OLD.application_class_name IS NOT NULL
        AND btrim(OLD.application_class_name) <> ''
        AND NEW.application_class_name IS DISTINCT FROM OLD.application_class_name THEN
    -- Preserve historical Class: applicants/clients cannot overwrite once set.
    NEW.application_class_name := OLD.application_class_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_application_class_name_update ON public.applications;
CREATE TRIGGER trg_stamp_application_class_name_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE PROCEDURE public.stamp_application_class_name_on_update();
