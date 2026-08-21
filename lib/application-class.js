/**
 * Canonical recruiting Class terminology for KSP.
 * User-facing copy must use "Class" — never "cohort".
 *
 * Site setting key: application_class_name (e.g. "11th Class")
 * Persisted per application: applications.application_class_name
 *
 * Legacy: site_settings.application_cohort_year — deprecated, do not use for UI.
 */

export const DEFAULT_APPLICATION_CLASS_NAME = "11th Class";
export const APPLICATION_CLASS_SETTING_KEY = "application_class_name";
export const LEGACY_COHORT_YEAR_SETTING_KEY = "application_cohort_year";

const MAX_CLASS_NAME_LEN = 40;

/** Normalize whitespace; empty → "". */
export function normalizeApplicationClassName(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw).trim().replace(/\s+/g, " ");
}

/**
 * Validate Director-managed Current Application Class.
 * Blank is not allowed for the active setting.
 */
export function validateApplicationClassName(raw) {
  const value = normalizeApplicationClassName(raw);
  if (!value) {
    return { ok: false, error: "Current Application Class is required" };
  }
  if (value.length > MAX_CLASS_NAME_LEN) {
    return {
      ok: false,
      error: `Current Application Class must be at most ${MAX_CLASS_NAME_LEN} characters`,
    };
  }
  if (/cohort/i.test(value)) {
    return {
      ok: false,
      error: 'Use Class terminology (e.g. "11th Class"), not "cohort"',
    };
  }
  return { ok: true, value };
}

/** Prefer application-persisted Class; never invent a Class when unknown. */
export function resolveApplicationClassName(application, globalClassName) {
  const persisted = normalizeApplicationClassName(application?.application_class_name);
  if (persisted) return persisted;
  return normalizeApplicationClassName(globalClassName) || "";
}

export function formatClassProgramName(className) {
  const c = normalizeApplicationClassName(className);
  return c ? `Kufuor Scholars Program ${c}` : "Kufuor Scholars Program";
}

export function formatClassApplicationLabel(className) {
  const c = normalizeApplicationClassName(className);
  return c ? `${c} Application` : "Application";
}

export function formatApplicationsForClass(className) {
  const c = normalizeApplicationClassName(className);
  return c ? `Applications for the ${c}` : "Applications";
}

export function formatHeroBadge(className, applicationsOpen) {
  const c = normalizeApplicationClassName(className) || DEFAULT_APPLICATION_CLASS_NAME;
  const upper = c.toUpperCase();
  return applicationsOpen
    ? `${upper} · APPLICATIONS OPEN`
    : `${upper} · APPLICATIONS CLOSED`;
}

export function formatOpenAnnouncement(className) {
  const c = normalizeApplicationClassName(className) || DEFAULT_APPLICATION_CLASS_NAME;
  return `${c.toUpperCase()} APPLICATIONS ARE NOW OPEN`;
}

export function formatSearchCampaign(className) {
  const c = normalizeApplicationClassName(className) || DEFAULT_APPLICATION_CLASS_NAME;
  return `The Search for the ${c} Begins.`;
}

/** Stage 2 YouTube title: "[Full Name] - KSP 11th Class Application" */
export function formatStage2VideoTitle(fullName, className) {
  const name = (fullName || "").trim() || "Your Full Name";
  const c = normalizeApplicationClassName(className);
  if (c) return `${name} - KSP ${c} Application`;
  return `${name} - KSP Application`;
}

export function stage2TitleConfirmationMessage(className) {
  const c = normalizeApplicationClassName(className);
  if (c) {
    return `Confirm that your video title follows: Full Name - KSP ${c} Application`;
  }
  return "Confirm that your video title follows: Full Name - KSP Application";
}
