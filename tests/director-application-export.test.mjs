import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs";

import {
  applyDirectorApplicationsListFilters,
  buildApplicantExportRecord,
  buildApplicantExportWorkbook,
  buildInviteeExportWorkbook,
  sanitizeSpreadsheetCell,
  selectApplicationsForExport,
  selectInviteesForExport,
} from "../lib/director-application-export.js";
import { directorExportFilename } from "../lib/director-application-export-types.js";
import { classifyDirectorApplications } from "../lib/director-application-workflow.js";

const routeSource = readFileSync(
  resolve("app/api/director/applications/export/route.js"),
  "utf8"
);
const dialogSource = readFileSync(
  resolve("components/director/DirectorApplicationsExport.jsx"),
  "utf8"
);
const typesSource = readFileSync(
  resolve("lib/director-application-export-types.js"),
  "utf8"
);

function app(id, status, extra = {}) {
  return {
    id,
    status,
    full_name: extra.full_name || id,
    phone: extra.phone || "0240000000",
    university: extra.university || "University of Ghana",
    program: extra.program || "Economics",
    region: extra.region || "Greater Accra",
    submitted_at: extra.submitted_at || "2026-10-01T12:00:00.000Z",
    profiles: { email: extra.email || `${id}@example.com` },
    ...extra,
  };
}

function classified(rows) {
  return classifyDirectorApplications(rows, {});
}

async function openSheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

function headerValues(sheet) {
  return sheet.getRow(1).values.slice(1);
}

test("Called for Interview exports only exact called_for_interview statuses", () => {
  const rows = classified([
    app("a", "called_for_interview"),
    app("b", "interview_review_pending"),
    app("c", "interview"),
    app("d", "stage_2_approved"),
    app("e", "rejected"),
  ]);
  const selected = selectApplicationsForExport(rows, "called_for_interview");
  assert.equal(selected.ok, true);
  assert.deepEqual(
    selected.rows.map((row) => row.app.id),
    ["a"]
  );
  assert.equal(selected.rows[0].app.status, "called_for_interview");
});

test("Rejected exports only exact rejected statuses", () => {
  const rows = classified([
    app("a", "rejected", { rejection_reason: "Incomplete documents", rejected_at: "2026-10-02" }),
    app("b", "called_for_interview"),
    app("c", "stage_1_submitted"),
  ]);
  const selected = selectApplicationsForExport(rows, "rejected");
  assert.deepEqual(
    selected.rows.map((row) => row.app.status),
    ["rejected"]
  );
  const record = buildApplicantExportRecord(selected.rows[0], {});
  assert.equal(record.rejection_reason, "Incomplete documents");
  assert.equal(record.decision_date, "2026-10-02");
});

test("All Submitted excludes drafts and keeps every other operational status", () => {
  const rows = classified([
    app("draft", "draft"),
    app("s1", "stage_1_submitted"),
    app("called", "called_for_interview"),
    app("rejected", "rejected"),
  ]);
  const selected = selectApplicationsForExport(rows, "all_submitted");
  assert.deepEqual(
    selected.rows.map((row) => row.app.id).sort(),
    ["called", "rejected", "s1"]
  );
});

test("Current filtered results match dashboard filtering, including incompatible filters", () => {
  const rows = classified([
    app("called", "called_for_interview", { full_name: "Ama Boateng" }),
    app("review", "interview_review_pending", { full_name: "Kwame Mensah" }),
    app("panel", "interview", { full_name: "Abena Owusu" }),
    app("rejected", "rejected", { full_name: "Yaw Darko" }),
    app("draft", "draft", { full_name: "Draft Person" }),
  ]);
  const filters = { status: "rejected", stage: "interview", workflow: "all", q: "" };
  const selected = selectApplicationsForExport(rows, "current_filtered", filters);
  const expected = applyDirectorApplicationsListFilters(rows, filters);
  assert.equal(selected.rows.length, 0);
  assert.equal(expected.length, 0);

  const interviewOnly = { status: "", stage: "interview", workflow: "all", q: "Ama" };
  const searched = selectApplicationsForExport(rows, "current_filtered", interviewOnly);
  const expectedSearch = applyDirectorApplicationsListFilters(rows, interviewOnly);
  assert.deepEqual(
    searched.rows.map((row) => row.app.id),
    expectedSearch.map((row) => row.app.id)
  );
  assert.deepEqual(
    searched.rows.map((row) => row.app.id),
    ["called"]
  );
});

test("export selection includes every matching record, not one page", () => {
  const rows = classified(
    Array.from({ length: 1001 }, (_, index) =>
      app(`id-${String(index).padStart(4, "0")}`, "called_for_interview", {
        full_name: `Person ${String(index).padStart(4, "0")}`,
      })
    )
  );
  const selected = selectApplicationsForExport(rows, "called_for_interview");
  assert.equal(selected.rows.length, 1001);
  assert.match(routeSource, /fetchAllApplicationPages/);
  assert.doesNotMatch(routeSource, /\.limit\(/);
});

test("special invitees stay on their own sheet and are not application rows", async () => {
  const invitees = selectInviteesForExport([
    {
      id: "invitee-1",
      full_name: "Ama Invitee",
      email: "ama@university.test",
      university: "KNUST",
      nationality: "Ghanaian",
      whatsapp_phone: "0246672876",
      programme_of_study: "Law",
      assigned_batch_name: "Batch A",
      invitation_delivery_status: null,
    },
  ]);
  const workbook = await buildInviteeExportWorkbook(invitees, {});
  const sheet = await openSheet(workbook.buffer);
  const headers = headerValues(sheet);
  assert.equal(sheet.name, "University Special Invitees");
  assert.ok(headers.includes("WhatsApp contact"));
  assert.ok(headers.includes("Nationality"));
  assert.equal(headers.includes("Application ID"), false);
  assert.equal(headers.includes("Application status"), false);
  assert.equal(sheet.getRow(2).getCell(1).value, "Ama Invitee");
  const statusCell = sheet.getRow(2).getCell(headers.indexOf("Invitation status") + 1).value;
  assert.equal(statusCell, "");
  assert.equal(selectApplicationsForExport([], "university_special_invitees").ok, false);
});

test("export route is director-only and does not write application records", () => {
  assert.match(routeSource, /requireActiveDirector\(\)/);
  assert.match(routeSource, /if \(gate\.error\) return gate\.error/);
  assert.match(routeSource, /Cache-Control": "no-store"/);
  assert.match(routeSource, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.doesNotMatch(routeSource, /\.update\(/);
  assert.doesNotMatch(routeSource, /\.insert\(/);
  assert.doesNotMatch(routeSource, /\.delete\(/);
  assert.doesNotMatch(routeSource, /\.upsert\(/);
  const handler = routeSource.slice(routeSource.indexOf("export async function POST"));
  const applicationsQuery = handler.indexOf('.from("applications")');
  const authGate = handler.indexOf("requireActiveDirector()");
  assert.ok(authGate >= 0 && applicationsQuery === -1);
  assert.match(handler, /loadOperationalApplications\(admin\)/);
  const loader = routeSource.slice(0, routeSource.indexOf("export async function POST"));
  assert.match(loader, /\.from\("applications"\)/);
});

test("user-controlled values cannot become spreadsheet formulas", () => {
  for (const sample of ["=1+1", "+233200000000", "-10", "@SUM(A1)", "\tcmd", "\r=1"]) {
    const safe = sanitizeSpreadsheetCell(sample);
    assert.equal(safe.startsWith("'"), true);
    assert.equal(safe.includes(sample), true);
  }
  assert.equal(sanitizeSpreadsheetCell("Ama Boateng"), "Ama Boateng");
  assert.equal(sanitizeSpreadsheetCell(null), "");
});

test("generated workbook is a real xlsx and does not change statuses", async () => {
  const source = [
    app("called", "called_for_interview", {
      full_name: '=HYPERLINK("http://evil.test")',
      phone: "+233200000000",
      interview_slot_id: "slot-1",
    }),
    app("other", "interview_review_pending"),
  ];
  const before = source.map((row) => row.status);
  const rows = classified(source).map((row) =>
    row.app.id === "called"
      ? { ...row, allocation: { application_id: "called", interview_slot_id: "slot-1" } }
      : row
  );
  const workbook = await buildApplicantExportWorkbook("called_for_interview", rows, {
    slotsById: {
      "slot-1": {
        id: "slot-1",
        batch_name: "Batch 2",
        interview_date: "2026-11-20",
        interview_time: "09:00:00",
        end_time: "09:15:00",
      },
    },
  });
  assert.deepEqual(
    source.map((row) => row.status),
    before
  );
  assert.equal(workbook.count, 1);
  assert.equal(workbook.buffer.subarray(0, 2).toString("utf8"), "PK");
  const sheet = await openSheet(workbook.buffer);
  assert.deepEqual(headerValues(sheet), [
    "Full name",
    "Application ID",
    "Email",
    "Phone number",
    "Institution",
    "Programme of study",
    "Region",
    "Application stage",
    "Application status",
    "Interview batch",
    "Interview date",
    "Interview time",
    "Submission date",
  ]);
  const name = sheet.getRow(2).getCell(1).value;
  assert.equal(typeof name, "string");
  assert.equal(name.startsWith("'"), true);
  assert.equal(sheet.getRow(2).getCell(1).formula, undefined);
  assert.equal(sheet.getRow(2).getCell(10).value, "Batch 2");
  assert.equal(sheet.getRow(2).getCell(11).value, "2026-11-20");
  assert.equal(sheet.getRow(2).getCell(12).value, "09:00–09:15");
  assert.equal(
    directorExportFilename("called_for_interview", new Date("2026-11-06T00:00:00.000Z")),
    "KSP_Called_For_Interview_2026-11-06.xlsx"
  );
  assert.equal(
    directorExportFilename("rejected", new Date("2026-11-06T00:00:00.000Z")),
    "KSP_Rejected_Applicants_2026-11-06.xlsx"
  );
  assert.equal(
    directorExportFilename("all_submitted", new Date("2026-11-06T00:00:00.000Z")),
    "KSP_All_Applications_2026-11-06.xlsx"
  );
});

test("export dialog previews the category count and disables a second download", () => {
  assert.match(dialogSource, /Export to Excel/);
  assert.match(dialogSource, /preview: true/);
  assert.match(dialogSource, /Counting records/);
  assert.match(dialogSource, /No records match this export/);
  assert.match(dialogSource, /disabled=\{downloading \|\| loadingPreview \|\| !preview \|\| preview\.count < 1\}/);
  assert.match(dialogSource, /DIRECTOR_EXPORT_TYPES/);
  assert.match(dialogSource, /called_for_interview/);
  assert.doesNotMatch(dialogSource, /exceljs/);
  assert.match(typesSource, /Called for Interview/);
  assert.match(typesSource, /University Special Invitees/);
  assert.match(typesSource, /Export Current Filtered Results/);
});
