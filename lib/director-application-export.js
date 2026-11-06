/**
 * Director Applications Excel export.
 *
 * Pure selection + workbook builders. Does not read or write application status.
 * Called for Interview is exact status `called_for_interview`, not the Interview stage.
 * University special invitees are never mixed into application exports.
 */

import ExcelJS from "exceljs";
import {
  DIRECTOR_EXPORT_LABELS,
  DIRECTOR_EXPORT_TYPES,
  directorExportFilename,
  isDirectorExportType,
} from "./director-application-export-types.js";
import {
  DIRECTOR_APPLICATION_STAGE_LABELS,
  DIRECTOR_PENDING_STATUSES,
  classifyDirectorApplicationStage,
  filterByDirectorApplicationStage,
  normalizeDirectorApplicationStageParam,
} from "./director-application-scope.js";
import {
  directorApplicationMatchesSearch,
  filterByDirectorAssessor,
  filterByDirectorWorkflow,
  normalizeDirectorAssessorParam,
} from "./director-application-workflow.js";
import {
  filterByDirectorStage2Review,
  normalizeDirectorStage2ReviewParam,
} from "./director-stage2-review.js";
import { UNIVERSITY_INVITEE_LABEL } from "./director-interview-invitees.js";

export {
  DIRECTOR_EXPORT_LABELS,
  DIRECTOR_EXPORT_TYPES,
  directorExportFilename,
  isDirectorExportType,
} from "./director-application-export-types.js";

const APPLICANT_COLUMNS = Object.freeze([
  { header: "Full name", key: "full_name", width: 28 },
  { header: "Application ID", key: "application_id", width: 38 },
  { header: "Email", key: "email", width: 32 },
  { header: "Phone number", key: "phone", width: 18 },
  { header: "Institution", key: "institution", width: 28 },
  { header: "Programme of study", key: "programme", width: 28 },
  { header: "Region", key: "region", width: 18 },
  { header: "Application stage", key: "application_stage", width: 20 },
  { header: "Application status", key: "application_status", width: 24 },
  { header: "Interview batch", key: "interview_batch", width: 22 },
  { header: "Interview date", key: "interview_date", width: 16 },
  { header: "Interview time", key: "interview_time", width: 18 },
  { header: "Submission date", key: "submission_date", width: 18 },
]);

const REJECTED_COLUMNS = Object.freeze([
  ...APPLICANT_COLUMNS,
  { header: "Rejection reason", key: "rejection_reason", width: 36 },
]);

const INVITEE_COLUMNS = Object.freeze([
  { header: "Full name", key: "full_name", width: 28 },
  { header: "Invitee ID", key: "invitee_id", width: 38 },
  { header: "Email", key: "email", width: 32 },
  { header: "University", key: "university", width: 28 },
  { header: "Nationality", key: "nationality", width: 18 },
  { header: "WhatsApp contact", key: "whatsapp", width: 20 },
  { header: "Programme of study", key: "programme", width: 28 },
  { header: "Assigned interview batch", key: "interview_batch", width: 28 },
  { header: "Interview date", key: "interview_date", width: 16 },
  { header: "Interview time", key: "interview_time", width: 18 },
  { header: "Invitation status", key: "invitation_status", width: 20 },
  { header: "Source", key: "source", width: 22 },
]);

export const DIRECTOR_EXPORT_APPLICATION_SELECT =
  "id, status, full_name, phone, university, program, region, submitted_at, stage_1_submitted_at, rejection_reason, interview_slot_id, interview_date, interview_time, profiles!applications_user_id_fkey(email)";

/**
 * Neutralize spreadsheet formula injection. Does not invent values.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeSpreadsheetCell(value) {
  if (value == null) return "";
  const text = String(value);
  if (!text) return "";
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  return text;
}

function textOrBlank(value) {
  if (typeof value !== "string") return value == null ? "" : String(value);
  return value.trim();
}

function dateOnly(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function timeLabel(start, end) {
  const a = typeof start === "string" ? start.trim().slice(0, 5) : "";
  const b = typeof end === "string" ? end.trim().slice(0, 5) : "";
  if (a && b) return `${a}–${b}`;
  return a || b || "";
}

function compareByNameThenId(a, b, idKey = "id") {
  const name = String(a?.full_name || a?.app?.full_name || "").localeCompare(
    String(b?.full_name || b?.app?.full_name || ""),
    undefined,
    { sensitivity: "base" }
  );
  if (name) return name;
  return String(a?.[idKey] || a?.app?.id || "").localeCompare(String(b?.[idKey] || b?.app?.id || ""));
}

export function operationalClassifiedRows(classified = []) {
  return (classified || []).filter((row) => row?.app?.status && row.app.status !== "draft");
}

/**
 * Same composition as /director/applications:
 * operational → Status → Stage → Stage 2 Review → Workflow → Assessor → search.
 */
export function applyDirectorApplicationsListFilters(classified = [], filters = {}) {
  let rows = operationalClassifiedRows(classified);
  const status = typeof filters.status === "string" ? filters.status.trim() : "";
  if (status === "pending") {
    rows = rows.filter((row) => DIRECTOR_PENDING_STATUSES.includes(row.app.status));
  } else if (status === "accepted" || status === "rejected") {
    rows = rows.filter((row) => row.app.status === status);
  } else if (status && status !== "draft") {
    rows = rows.filter((row) => row.app.status === status);
  }

  const stage = normalizeDirectorApplicationStageParam(filters.stage);
  rows = filterByDirectorApplicationStage(rows, stage);
  const stage2 = normalizeDirectorStage2ReviewParam(filters.stage2);
  rows = filterByDirectorStage2Review(rows, stage2);
  const workflow =
    typeof filters.workflow === "string" && filters.workflow.trim()
      ? filters.workflow.trim()
      : "all";
  rows = filterByDirectorWorkflow(rows, workflow);
  rows = filterByDirectorAssessor(rows, normalizeDirectorAssessorParam(filters.assessor));
  const q = typeof filters.q === "string" ? filters.q.trim() : "";
  if (q) rows = rows.filter((row) => directorApplicationMatchesSearch(row.app, q));
  return rows;
}

/**
 * Select application rows for an allowlisted export type.
 * Invitee exports do not use this function.
 */
export function selectApplicationsForExport(classified = [], type, filters = {}) {
  if (!isDirectorExportType(type) || type === "university_special_invitees") {
    return { ok: false, error: "Invalid export type.", rows: [] };
  }
  const operational = operationalClassifiedRows(classified);
  let rows;
  if (type === "called_for_interview") {
    rows = operational.filter((row) => row.app.status === "called_for_interview");
  } else if (type === "rejected") {
    rows = operational.filter((row) => row.app.status === "rejected");
  } else if (type === "pending") {
    rows = operational.filter((row) => DIRECTOR_PENDING_STATUSES.includes(row.app.status));
  } else if (type === "stage_1" || type === "stage_2") {
    rows = filterByDirectorApplicationStage(operational, type);
  } else if (type === "all_submitted") {
    rows = operational;
  } else {
    rows = applyDirectorApplicationsListFilters(operational, filters);
  }
  rows = [...rows].sort((a, b) => compareByNameThenId(a, b));
  return { ok: true, rows };
}

export function applicantExportColumns(type) {
  if (type === "rejected" || type === "current_filtered") return REJECTED_COLUMNS;
  return APPLICANT_COLUMNS;
}

export function buildApplicantExportRecord(row, slotsById = {}) {
  const app = row?.app || row || {};
  const slotId = row?.allocation?.interview_slot_id || app.interview_slot_id || null;
  const slot = slotId ? slotsById[slotId] || null : null;
  const stageKey = classifyDirectorApplicationStage(app.status);
  const email =
    (typeof app.profiles?.email === "string" && app.profiles.email.trim()) ||
    (typeof app.email === "string" && app.email.trim()) ||
    "";
  return {
    full_name: textOrBlank(app.full_name),
    application_id: app.id || "",
    email,
    phone: textOrBlank(app.phone),
    institution: textOrBlank(app.university),
    programme: textOrBlank(app.program),
    region: textOrBlank(app.region),
    application_stage: stageKey ? DIRECTOR_APPLICATION_STAGE_LABELS[stageKey] || "" : "",
    application_status: app.status || "",
    interview_batch: textOrBlank(slot?.batch_name),
    interview_date: dateOnly(slot?.interview_date || app.interview_date),
    interview_time: slot
      ? timeLabel(slot.interview_time, slot.end_time)
      : timeLabel(app.interview_time, null),
    submission_date: dateOnly(app.submitted_at || app.stage_1_submitted_at),
    rejection_reason: textOrBlank(app.rejection_reason),
  };
}

export function buildInviteeExportRecord(invitee, slotsById = {}) {
  const slotId = invitee?.interview_slot_id || invitee?.assigned_slot_id || null;
  const slot = slotId ? slotsById[slotId] || null : null;
  return {
    full_name: textOrBlank(invitee?.full_name),
    invitee_id: invitee?.id || "",
    email: textOrBlank(invitee?.email),
    university: textOrBlank(invitee?.university),
    nationality: textOrBlank(invitee?.nationality),
    whatsapp: textOrBlank(invitee?.whatsapp_phone),
    programme: textOrBlank(invitee?.programme_of_study),
    interview_batch: textOrBlank(slot?.batch_name || invitee?.assigned_batch_name),
    interview_date: dateOnly(slot?.interview_date || invitee?.assigned_batch_date),
    interview_time: slot
      ? timeLabel(slot.interview_time, slot.end_time)
      : textOrBlank(invitee?.assigned_batch_time),
    invitation_status: textOrBlank(invitee?.invitation_delivery_status),
    source: UNIVERSITY_INVITEE_LABEL,
  };
}

export function selectInviteesForExport(invitees = []) {
  return [...(invitees || [])]
    .filter((row) => row && row.id)
    .sort((a, b) => compareByNameThenId(a, b));
}

export async function buildDirectorExportWorkbook({ sheetName, columns, records }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kufuor Scholars Program";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(String(sheetName || "Export").slice(0, 31));
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 20,
  }));
  for (const record of records || []) {
    const safe = {};
    for (const column of columns) {
      safe[column.key] = sanitizeSpreadsheetCell(record?.[column.key]);
    }
    const added = sheet.addRow(safe);
    added.eachCell((cell) => {
      if (typeof cell.value === "string") cell.value = String(cell.value);
    });
  }
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildApplicantExportWorkbook(type, classifiedRows, { slotsById = {}, filters = {} } = {}) {
  const selected = selectApplicationsForExport(classifiedRows, type, filters);
  if (!selected.ok) return selected;
  const columns = applicantExportColumns(type);
  const records = selected.rows.map((row) => buildApplicantExportRecord(row, slotsById));
  const buffer = await buildDirectorExportWorkbook({
    sheetName: DIRECTOR_EXPORT_LABELS[type] || "Applications",
    columns,
    records,
  });
  return { ok: true, count: records.length, columns, records, buffer };
}

export async function buildInviteeExportWorkbook(invitees = [], slotsById = {}) {
  const rows = selectInviteesForExport(invitees);
  const records = rows.map((row) => buildInviteeExportRecord(row, slotsById));
  const buffer = await buildDirectorExportWorkbook({
    sheetName: "University Special Invitees",
    columns: INVITEE_COLUMNS,
    records,
  });
  return { ok: true, count: records.length, columns: INVITEE_COLUMNS, records, buffer };
}
