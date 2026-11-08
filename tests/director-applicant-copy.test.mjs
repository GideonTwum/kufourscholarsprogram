import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_COPY_CONTACT_FIELDS,
  DIRECTOR_COPY_DEFAULT_FIELDS,
  DIRECTOR_COPY_EXTRA_OPTIONAL_FIELDS,
  DIRECTOR_COPY_FIELD_KEYS,
  DIRECTOR_COPY_NOT_PROVIDED,
  buildDirectorCopyValues,
  defaultDirectorCopySelection,
  formatDirectorCopyAcademicResults,
  formatDirectorCopyAge,
  formatDirectorCopyText,
  normalizeDirectorCopySelection,
  resolveDirectorCopyInterviewBatch,
} from "../lib/director-applicant-copy.js";

const pageSource = readFileSync(
  resolve("app/(dashboard)/director/applications/[id]/page.js"),
  "utf8"
);
const dialogSource = readFileSync(
  resolve("components/director/DirectorCopyApplicantDetails.jsx"),
  "utf8"
);
const libSource = readFileSync(resolve("lib/director-applicant-copy.js"), "utf8");

test("default selection is minimal and keeps contact and new optional fields unchecked", () => {
  const selected = defaultDirectorCopySelection();
  assert.deepEqual(selected, [
    "full_name",
    "application_id",
    "institution",
    "programme",
    "application_status",
    "interview_batch",
  ]);
  for (const key of DIRECTOR_COPY_CONTACT_FIELDS) {
    assert.equal(selected.includes(key), false);
  }
  for (const key of DIRECTOR_COPY_EXTRA_OPTIONAL_FIELDS) {
    assert.equal(selected.includes(key), false);
  }
  assert.deepEqual(DIRECTOR_COPY_DEFAULT_FIELDS, selected);
  assert.ok(DIRECTOR_COPY_FIELD_KEYS.includes("level_of_study"));
  assert.ok(DIRECTOR_COPY_FIELD_KEYS.includes("age"));
  assert.ok(DIRECTOR_COPY_FIELD_KEYS.includes("academic_results"));
});

test("copy values use authorized application fields and readable status labels", () => {
  const values = buildDirectorCopyValues({
    application: {
      id: "app-1",
      full_name: "Ama Boateng",
      phone: "0240000000",
      university: "University of Ghana",
      program: "Economics",
      status: "called_for_interview",
      interview_slot_id: "slot-1",
      year_of_study: "Sophomore",
      date_of_birth: "2004-06-15",
      grade_type: "CGPA",
      gpa: "3.52",
    },
    email: "ama@example.com",
    asOf: new Date(2026, 10, 8),
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
  assert.equal(values.full_name, "Ama Boateng");
  assert.equal(values.application_id, "app-1");
  assert.equal(values.email, "ama@example.com");
  assert.equal(values.phone, "0240000000");
  assert.equal(values.institution, "University of Ghana");
  assert.equal(values.programme, "Economics");
  assert.equal(values.level_of_study, "Sophomore");
  assert.equal(values.age, "22");
  assert.equal(values.academic_results, "CGPA: 3.52");
  assert.equal(values.application_status, "Called for interview");
  assert.equal(values.interview_batch, "Batch 2 · 2026-11-20 · 09:00:00–09:15:00");
});

test("level of study preserves the exact recorded year_of_study value", () => {
  assert.equal(
    buildDirectorCopyValues({
      application: { id: "a", year_of_study: "First Year" },
    }).level_of_study,
    "First Year"
  );
  assert.equal(
    buildDirectorCopyValues({
      application: { id: "b", year_of_study: "Level 200" },
    }).level_of_study,
    "Level 200"
  );
  assert.equal(
    buildDirectorCopyValues({ application: { id: "c" } }).level_of_study,
    ""
  );
});

test("age is birthday-aware and does not invent values from submission dates", () => {
  const asOf = new Date(2026, 10, 8); // 8 Nov 2026
  assert.equal(formatDirectorCopyAge("2004-11-09", asOf), "21");
  assert.equal(formatDirectorCopyAge("2004-11-08", asOf), "22");
  assert.equal(formatDirectorCopyAge("2004-06-15", asOf), "22");
  assert.equal(formatDirectorCopyAge("", asOf), "");
  assert.equal(formatDirectorCopyAge(null, asOf), "");
  assert.equal(formatDirectorCopyAge("not-a-date", asOf), "");
  const values = buildDirectorCopyValues({
    application: {
      id: "app-age",
      date_of_birth: "2005-12-01",
      submitted_at: "2020-01-01T00:00:00.000Z",
      stage_1_submitted_at: "2020-01-01T00:00:00.000Z",
    },
    asOf,
  });
  assert.equal(values.age, "20");
});

test("academic results format recorded grades and never include document URLs", () => {
  assert.equal(
    formatDirectorCopyAcademicResults({ grade_type: "CWA", gpa: "72.5" }),
    "CWA: 72.5"
  );
  assert.equal(formatDirectorCopyAcademicResults({ gpa: "3.1" }), "3.1");
  assert.equal(
    formatDirectorCopyAcademicResults({
      grade_type: "CGPA",
      gpa: "3.80",
      wassce_results_urls: ["user/wassce-results/secret.pdf"],
      academic_transcript_url: "https://example.com/private.pdf",
    }),
    "CGPA: 3.80"
  );
  assert.equal(
    formatDirectorCopyAcademicResults({
      wassce_grades: [
        { subject: "English Language", grade: "B3" },
        { subject: "Mathematics", grade: "A1" },
        { subject: "https://evil.test", grade: "A1" },
      ],
      grade_type: "GPA",
      gpa: "3.2",
    }),
    "English Language — B3\nMathematics — A1\nGPA: 3.2"
  );
  assert.equal(formatDirectorCopyAcademicResults({}), "");
  assert.doesNotMatch(libSource, /wassce_results_urls/);
  assert.doesNotMatch(libSource, /academic_transcript_url/);
});

test("missing optional fields show Not provided when selected", () => {
  const values = buildDirectorCopyValues({
    application: {
      id: "app-2",
      full_name: "Kwame Mensah",
      university: "KNUST",
      program: "Law",
      status: "rejected",
      phone: "",
    },
    email: "kwame@example.com",
  });
  const text = formatDirectorCopyText(values, [
    "full_name",
    "application_id",
    "email",
    "phone",
    "institution",
    "programme",
    "level_of_study",
    "age",
    "academic_results",
    "application_status",
    "interview_batch",
  ]);
  assert.match(text, /^Applicant details\n\n/);
  assert.match(text, /Full name: Kwame Mensah/);
  assert.match(text, /Application ID: app-2/);
  assert.match(text, /Email: kwame@example.com/);
  assert.match(text, /Institution: KNUST/);
  assert.match(text, /Programme of study: Law/);
  assert.match(text, /Level of study: Not provided/);
  assert.match(text, /Age: Not provided/);
  assert.match(text, /Academic results: Not provided/);
  assert.match(text, /Application status: Rejected/);
  assert.equal(text.includes("Phone:"), false);
  assert.equal(text.includes("Interview batch:"), false);
  assert.equal(DIRECTOR_COPY_NOT_PROVIDED, "Not provided");
});

test("selected academic results appear in clipboard preview text", () => {
  const values = buildDirectorCopyValues({
    application: {
      id: "app-3",
      full_name: "Abena Owusu",
      year_of_study: "First Year",
      date_of_birth: "2005-01-01",
      grade_type: "CGPA",
      gpa: "3.90",
      wassce_grades: [{ subject: "Integrated Science", grade: "B2" }],
      status: "stage_1_submitted",
    },
    asOf: new Date(2026, 10, 8),
  });
  const text = formatDirectorCopyText(values, [
    "full_name",
    "level_of_study",
    "age",
    "academic_results",
  ]);
  assert.match(text, /Full name: Abena Owusu/);
  assert.match(text, /Level of study: First Year/);
  assert.match(text, /Age: 21/);
  assert.match(text, /Academic results:/);
  assert.match(text, /Integrated Science — B2/);
  assert.match(text, /CGPA: 3\.90/);
});

test("selection normalization ignores unknown and sensitive keys", () => {
  assert.deepEqual(
    normalizeDirectorCopySelection([
      "full_name",
      "director_notes",
      "password",
      "access_token",
      "email",
      "assessor_notes",
      "level_of_study",
      "age",
      "academic_results",
      "wassce_results_urls",
    ]),
    ["full_name", "email", "level_of_study", "age", "academic_results"]
  );
  assert.deepEqual(DIRECTOR_COPY_FIELD_KEYS.includes("director_notes"), false);
});

test("interview batch resolves from slot or legacy date/time without inventing values", () => {
  assert.equal(resolveDirectorCopyInterviewBatch({ id: "a" }), "");
  assert.equal(
    resolveDirectorCopyInterviewBatch({
      interview_date: "2026-11-20",
      interview_time: "09:00",
    }),
    "2026-11-20 · 09:00"
  );
  assert.equal(
    resolveDirectorCopyInterviewBatch(
      { interview_slot_id: "slot-9" },
      null,
      {
        "slot-9": {
          batch_name: "Batch A",
          interview_date: "2026-12-01",
          interview_time: "10:00",
        },
      }
    ),
    "Batch A · 2026-12-01 · 10:00"
  );
});

test("detail page wires Copy Details and dialog uses Clipboard API", () => {
  assert.match(pageSource, /DirectorCopyApplicantDetails/);
  assert.match(dialogSource, /Copy Details/);
  assert.match(dialogSource, /navigator\.clipboard\.writeText/);
  assert.match(dialogSource, /Copied to clipboard/);
  assert.match(dialogSource, /Could not copy/);
  assert.match(dialogSource, /defaultDirectorCopySelection/);
  assert.match(dialogSource, /\(optional\)/);
  assert.doesNotMatch(libSource, /director_notes/);
  assert.doesNotMatch(libSource, /password/);
  assert.doesNotMatch(libSource, /access_token/);
  assert.doesNotMatch(dialogSource, /director_notes/);
});
