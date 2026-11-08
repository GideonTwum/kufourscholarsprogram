import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_COPY_CONTACT_FIELDS,
  DIRECTOR_COPY_DEFAULT_FIELDS,
  DIRECTOR_COPY_FIELD_KEYS,
  buildDirectorCopyValues,
  defaultDirectorCopySelection,
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

test("default selection is minimal and keeps contact fields unchecked", () => {
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
  assert.deepEqual(DIRECTOR_COPY_DEFAULT_FIELDS, selected);
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
    },
    email: "ama@example.com",
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
  assert.equal(values.application_status, "Called for interview");
  assert.equal(values.interview_batch, "Batch 2 · 2026-11-20 · 09:00:00–09:15:00");
});

test("formatted text includes only selected available fields", () => {
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
    "application_status",
    "interview_batch",
  ]);
  assert.match(text, /^Applicant details\n\n/);
  assert.match(text, /Full name: Kwame Mensah/);
  assert.match(text, /Application ID: app-2/);
  assert.match(text, /Email: kwame@example.com/);
  assert.match(text, /Institution: KNUST/);
  assert.match(text, /Programme of study: Law/);
  assert.match(text, /Application status: Rejected/);
  assert.equal(text.includes("Phone:"), false);
  assert.equal(text.includes("Interview batch:"), false);
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
    ]),
    ["full_name", "email"]
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
