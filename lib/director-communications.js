/**
 * Director → applicant communications: audiences, templates, personalization,
 * and recipient resolution helpers.
 *
 * Audiences reuse Director operational scope + workflow classifier.
 * Recipients are always resolved server-side — never from client email lists.
 */

import {
  DIRECTOR_PENDING_STATUSES,
  applyDirectorOperationalScope,
} from "./director-application-scope.js";
import {
  classifyDirectorApplications,
  buildDirectorAssignmentWorkflowMap,
  DIRECTOR_WORKFLOW_LABELS,
} from "./director-application-workflow.js";
import { escapeHtmlWithBreaks } from "./email/escape.js";

/** Max emails sent in a single HTTP request (progressive batching for larger audiences). */
export const COMMUNICATION_BATCH_SIZE = 15;

/** Soft preview page size for Director UI. */
export const COMMUNICATION_PREVIEW_LIMIT = 50;

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 12000;

export const COMMUNICATION_AUDIENCES = [
  "all_submitted",
  "pending",
  "unassigned",
  "assigned",
  "assessed",
  "interview_panel",
  "interview_review_pending",
  "called_for_interview",
  "accepted",
  "rejected",
  "individual",
];

/**
 * Exact status-membership audiences (not workflow classifier buckets).
 * pending uses DIRECTOR_PENDING_STATUSES; accepted/rejected are exact matches.
 */
export const COMMUNICATION_STATUS_AUDIENCES = [
  "pending",
  "interview_review_pending",
  "called_for_interview",
  "accepted",
  "rejected",
];

export const COMMUNICATION_AUDIENCE_LABELS = {
  all_submitted: "All Submitted",
  pending: "Pending",
  unassigned: "Unassigned",
  assigned: "Assigned",
  assessed: "Assessed",
  interview_panel: "Interview Pipeline",
  interview_review_pending: "Shortlisted (Unscheduled)",
  called_for_interview: "Called for Interview",
  accepted: "Accepted",
  rejected: "Rejected",
  individual: "Individual Applicant",
};

/** Guidance shown in Compose UI — helps Directors avoid wrong templates. */
export const COMMUNICATION_AUDIENCE_HINTS = {
  pending:
    "Matches Director Applications → Pending: every operational application that is not accepted or rejected (includes interview stages).",
  interview_panel:
    "Interview pipeline: interview_review_pending + called_for_interview + interview. Use for neutral pipeline updates — not for “congratulations, you are shortlisted” wording.",
  interview_review_pending:
    "Only applicants with status interview_review_pending (shortlisted / unscheduled). Prefer the Shortlisted template here.",
  called_for_interview:
    "Only applicants with status called_for_interview (scheduled). Prefer Interview Details — not a first-time shortlist announcement.",
  accepted: "Exact status accepted only. Not based on assessor recommendations.",
  rejected: "Exact status rejected only. Not based on assessor recommendations.",
};

export const COMMUNICATION_STATUSES = [
  "draft",
  "queued",
  "processing",
  "completed",
  "partial_failure",
  "failed",
];

export const PERSONALIZATION_VARS = ["first_name", "full_name"];

/** Stale sending claims older than this are reclaimed as pending (crashed worker). */
export const SENDING_CLAIM_STALE_MS = 5 * 60 * 1000;

/**
 * Pure helper: resume/continue only attempts pending rows.
 * sent / failed / skipped are never auto-retried.
 */
export function shouldAttemptDelivery(deliveryStatus) {
  return deliveryStatus === "pending";
}

/**
 * Continue/resume operates on director_communication_recipients only —
 * audience membership is never recalculated after campaign creation.
 */
export function continueUsesPersistedSnapshotOnly() {
  return true;
}

export const COMMUNICATION_TEMPLATES = [
  {
    id: "application_update",
    label: "Application Update",
    subject: "Kufuor Scholars Program — Application Update",
    body: `Dear {{first_name}},

Thank you for your interest in the Kufuor Scholars Program.

We are writing with an update regarding your application. Please continue to monitor your applicant portal and email for further guidance.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "assessment_update",
    label: "Assessment Update",
    subject: "Kufuor Scholars Program — Assessment Update",
    body: `Dear {{first_name}},

Thank you for your patience as we review applications for the Kufuor Scholars Program.

We are writing with an update on the assessment stage of your application. Please check your applicant portal for any required next steps.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "shortlisted_interview",
    label: "Shortlisted for Interview",
    subject: "Kufuor Scholars Program — Shortlisted for Interview",
    body: `Dear {{first_name}},

Congratulations. You have been shortlisted for the next stage of the Kufuor Scholars Program recruitment process.

We will share interview details shortly through your applicant portal and email. Please ensure your contact details remain up to date.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "interview_details",
    label: "Interview Details",
    subject: "Kufuor Scholars Program — Interview Details",
    body: `Dear {{first_name}},

Please find your interview details for the Kufuor Scholars Program below.

Date: [insert date]
Time: [insert time]
Location / Format: [insert details]
Instructions: [insert any preparation notes]

If you have any questions, reply to this email or contact the Programme Office through your applicant portal.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "accepted",
    label: "Accepted",
    subject: "Kufuor Scholars Program — Congratulations",
    body: `Dear {{first_name}},

Congratulations. We are delighted to inform you that you have been accepted into the Kufuor Scholars Program.

Further onboarding details will follow. Please watch your email and applicant portal closely.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "not_selected",
    label: "Not Selected",
    subject: "Kufuor Scholars Program — Application Decision",
    body: `Dear {{first_name}},

Thank you for applying to the Kufuor Scholars Program and for the time and care you invested in your application.

After careful review, we are unable to offer you a place in this Class. This decision does not diminish the strength of your leadership potential, and we encourage you to continue pursuing opportunities for growth and service.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "missing_information",
    label: "Missing Information",
    subject: "Kufuor Scholars Program — Information Needed",
    body: `Dear {{first_name}},

We are reviewing your application to the Kufuor Scholars Program and need additional information or a document from you.

Please log in to your applicant portal and respond as soon as possible. If you have already provided the requested material, you may disregard this message.

Warm regards,
Kufuor Scholars Program`,
  },
  {
    id: "custom",
    label: "Custom Message",
    subject: "",
    body: `Dear {{first_name}},

`,
  },
];

export function isValidCommunicationAudience(audience) {
  return COMMUNICATION_AUDIENCES.includes(audience);
}

export function getCommunicationTemplate(id) {
  return COMMUNICATION_TEMPLATES.find((t) => t.id === id) || null;
}

/**
 * Extract first name from a full name (first whitespace-separated token).
 */
export function deriveFirstName(fullName) {
  const raw = typeof fullName === "string" ? fullName.trim() : "";
  if (!raw) return "Applicant";
  return raw.split(/\s+/)[0] || "Applicant";
}

/**
 * Replace allowlisted {{var}} tokens only. Unknown tokens are left unchanged
 * (not evaluated). Values are plain-text substituted — HTML escaping happens
 * when building email HTML.
 */
export function applyPersonalization(template, vars = {}) {
  const source = typeof template === "string" ? template : "";
  const allow = new Set(PERSONALIZATION_VARS);
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (!allow.has(key)) return match;
    const value = vars[key];
    if (value == null || String(value).trim() === "") {
      return key === "first_name" ? "Applicant" : "";
    }
    return String(value);
  });
}

export function buildPersonalizedEmail({ subject, body, fullName }) {
  const full = (fullName || "").trim() || "Applicant";
  const vars = {
    first_name: deriveFirstName(full),
    full_name: full,
  };
  const personalizedSubject = applyPersonalization(subject, vars).trim();
  const personalizedBody = applyPersonalization(body, vars).trim();
  return {
    subject: personalizedSubject,
    text: personalizedBody,
    html: `<div style="font-family: sans-serif; line-height: 1.5;">${escapeHtmlWithBreaks(personalizedBody)}</div>`,
    vars,
  };
}

export function validateCommunicationContent({ subject, body }) {
  const errors = {};
  const subj = typeof subject === "string" ? subject.trim() : "";
  const msg = typeof body === "string" ? body.trim() : "";
  if (!subj) errors.subject = "Subject is required.";
  else if (subj.length > MAX_SUBJECT_LENGTH) {
    errors.subject = `Subject must be at most ${MAX_SUBJECT_LENGTH} characters.`;
  }
  if (!msg) errors.body = "Message is required.";
  else if (msg.length > MAX_BODY_LENGTH) {
    errors.body = `Message must be at most ${MAX_BODY_LENGTH} characters.`;
  }
  return errors;
}

/**
 * Filter classified operational rows by communication audience.
 * @param {Array<{ app: object, workflow: string|null }>} classified
 * @param {string} audience
 * @param {string|null} applicationId — required for individual
 */
export function filterClassifiedByAudience(classified, audience, applicationId = null) {
  const list = Array.isArray(classified) ? classified : [];
  if (!isValidCommunicationAudience(audience)) return [];

  if (audience === "individual") {
    if (!applicationId) return [];
    return list.filter((row) => row.app?.id === applicationId);
  }
  if (audience === "all_submitted") return list;
  if (audience === "pending") {
    return list.filter((row) => DIRECTOR_PENDING_STATUSES.includes(row.app?.status));
  }
  if (audience === "accepted") {
    return list.filter((row) => row.app?.status === "accepted");
  }
  if (audience === "rejected") {
    return list.filter((row) => row.app?.status === "rejected");
  }
  if (audience === "interview_review_pending") {
    return list.filter((row) => row.app?.status === "interview_review_pending");
  }
  if (audience === "called_for_interview") {
    return list.filter((row) => row.app?.status === "called_for_interview");
  }
  // Workflow audiences (unassigned / assigned / assessed / interview_panel)
  return list.filter((row) => row.workflow === audience);
}

/**
 * Deduplicate recipients by user_id (preferred), else normalized email.
 * One message per person even if multiple application rows exist.
 */
export function dedupeCommunicationRecipients(rows) {
  const seenUser = new Set();
  const seenEmail = new Set();
  const out = [];
  for (const row of rows || []) {
    const userId = row.user_id || row.app?.user_id || null;
    const emailRaw =
      row.email ||
      row.profiles?.email ||
      row.app?.profiles?.email ||
      row.app?.email ||
      "";
    const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    if (userId) {
      if (seenUser.has(userId)) continue;
      seenUser.add(userId);
      if (email) seenEmail.add(email);
    } else if (email) {
      if (seenEmail.has(email)) continue;
      seenEmail.add(email);
    } else {
      // Keep for exclusion reporting (no email)
    }
    out.push(row);
  }
  return out;
}

export function isValidRecipientEmail(email) {
  if (typeof email !== "string") return false;
  const e = email.trim();
  if (!e || !e.includes("@") || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Map classified application rows into recipient descriptors.
 */
export function buildRecipientDescriptors(classifiedRows) {
  return (classifiedRows || []).map((row) => {
    const app = row.app || {};
    const fullName =
      (typeof app.full_name === "string" && app.full_name.trim()) ||
      (typeof app.profiles?.full_name === "string" && app.profiles.full_name.trim()) ||
      "Applicant";
    const email =
      (typeof app.profiles?.email === "string" && app.profiles.email.trim()) ||
      (typeof app.email === "string" && app.email.trim()) ||
      "";
    return {
      application_id: app.id,
      user_id: app.user_id || null,
      full_name: fullName,
      university: app.university || "",
      status: app.status || "",
      workflow: row.workflow,
      workflow_label: row.workflow ? DIRECTOR_WORKFLOW_LABELS[row.workflow] : null,
      email,
    };
  });
}

/**
 * Split recipients into sendable vs excluded (invalid/missing email).
 */
export function partitionRecipients(descriptors) {
  const sendable = [];
  const excluded = [];
  for (const row of descriptors || []) {
    if (isValidRecipientEmail(row.email)) sendable.push({ ...row, email: row.email.trim() });
    else excluded.push(row);
  }
  return { sendable, excluded };
}

/**
 * Load operational applications + classify for communications (Admin client).
 */
export async function resolveCommunicationAudience(admin, audience, applicationId = null) {
  if (!isValidCommunicationAudience(audience)) {
    return {
      ok: false,
      error: "Invalid audience.",
      sendable: [],
      excluded: [],
      totalMatched: 0,
    };
  }

  if (audience === "individual") {
    if (!applicationId) {
      return { ok: false, error: "application_id is required for individual messages.", sendable: [], excluded: [], totalMatched: 0 };
    }
    const { data: app, error } = await admin
      .from("applications")
      .select(
        "id, user_id, status, full_name, university, email, profiles!applications_user_id_fkey(full_name, email)"
      )
      .eq("id", applicationId)
      .maybeSingle();
    if (error) {
      return { ok: false, error: "Could not load application.", sendable: [], excluded: [], totalMatched: 0 };
    }
    if (!app || app.status === "draft") {
      return { ok: false, error: "Application not found or is still a draft.", sendable: [], excluded: [], totalMatched: 0 };
    }
    const classified = classifyDirectorApplications([app], {});
    const descriptors = buildRecipientDescriptors(classified);
    const deduped = dedupeCommunicationRecipients(descriptors);
    const { sendable, excluded } = partitionRecipients(deduped);
    return {
      ok: true,
      audience,
      audienceLabel: COMMUNICATION_AUDIENCE_LABELS[audience],
      sendable,
      excluded,
      totalMatched: deduped.length,
    };
  }

  let query = admin
    .from("applications")
    .select(
      "id, user_id, status, full_name, university, email, profiles!applications_user_id_fkey(full_name, email)"
    );
  query = applyDirectorOperationalScope(query);
  const { data: applications, error: appErr } = await query;
  if (appErr) {
    return { ok: false, error: "Could not load applications.", sendable: [], excluded: [], totalMatched: 0 };
  }

  const apps = applications || [];
  const { data: assignmentRows } = await admin
    .from("assessor_assignments")
    .select("application_id, assessor_id, status, profiles:assessor_id(full_name, email)")
    .eq("status", "active");

  const active = assignmentRows || [];
  const appIds = active.map((r) => r.application_id).filter(Boolean);
  let assessments = [];
  if (appIds.length > 0) {
    const { data: assessmentRows } = await admin
      .from("application_assessments")
      .select(
        "application_id, assessor_id, stage, recommendation, submitted_at, assessor_name_snapshot"
      )
      .in("application_id", appIds)
      .order("submitted_at", { ascending: false });
    assessments = assessmentRows || [];
  }

  const statusByAppId = Object.fromEntries(apps.map((a) => [a.id, a.status]));
  const assignmentMap = buildDirectorAssignmentWorkflowMap(active, assessments, statusByAppId);
  const classified = classifyDirectorApplications(apps, assignmentMap);
  const filtered = filterClassifiedByAudience(classified, audience, applicationId);
  const descriptors = buildRecipientDescriptors(filtered);
  const deduped = dedupeCommunicationRecipients(descriptors);
  const { sendable, excluded } = partitionRecipients(deduped);

  return {
    ok: true,
    audience,
    audienceLabel: COMMUNICATION_AUDIENCE_LABELS[audience],
    sendable,
    excluded,
    totalMatched: deduped.length,
  };
}
