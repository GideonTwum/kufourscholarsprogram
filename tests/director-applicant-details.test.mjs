import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildApplicantDetailsCorrection } from "../lib/director-applicant-details.js";
import { DIRECTOR_AUDIT_ACTIONS } from "../lib/audit/director-audit.js";
import { aggregateDirectorDemographics } from "../lib/director-demographics.js";

const current = {
  full_name: "Ama Mensah",
  university: "University of Ghana",
  hometown: "Kumasi",
  program: "Economics",
  gender: "female",
  status: "stage_1_submitted",
};

function edit(overrides, base = current) {
  return buildApplicantDetailsCorrection(
    {
      full_name: base.full_name,
      university: base.university,
      hometown: base.hometown,
      program: base.program,
      gender: base.gender,
      reason: "Spelling correction",
      ...overrides,
    },
    base
  );
}

test("1. Director edits full name", () => {
  const result = edit({ full_name: "Ama Serwaa Mensah" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.newValue, { full_name: "Ama Serwaa Mensah" });
  assert.equal(result.syncProfileName, true);
});

test("2. Director edits university", () => {
  const result = edit({ university: "kwame nkrumah university of science and technology" });
  assert.equal(result.ok, true);
  assert.equal(result.newValue.university, "Kwame Nkrumah University of Science and Technology");
});

test("3. Director edits hometown", () => {
  const result = edit({ hometown: "Accra" });
  assert.equal(result.newValue.hometown, "Accra");
  assert.equal(result.oldValue.hometown, "Kumasi");
});

test("4. Director edits programme", () => {
  const result = edit({ program: "Law" });
  assert.equal(result.newValue.program, "Law");
});

test("5. Director edits gender", () => {
  const result = edit({ gender: "Male" });
  assert.equal(result.newValue.gender, "male");
});

test("6. Partial edits preserve unchanged fields", () => {
  const result = edit({ hometown: "Tamale" });
  assert.deepEqual(Object.keys(result.patch), ["hometown"]);
  assert.equal(result.patch.full_name, undefined);
  assert.equal(result.patch.university, undefined);
  assert.equal(result.patch.program, undefined);
  assert.equal(result.patch.gender, undefined);
});

test("7. Invalid gender rejected", () => {
  const result = edit({ gender: "other" });
  assert.equal(result.ok, false);
  assert.match(result.error, /Gender/);
});

test("8-10. Route requires active director and rejects unknown fields", () => {
  const route = readFileSync(
    resolve("app/api/director/applications/[id]/details/route.js"),
    "utf8"
  );
  assert.match(route, /requireActiveDirector/);
  assert.match(route, /ACCOUNT_DEACTIVATED|gate\.error/);
  const unknown = buildApplicantDetailsCorrection(
    { full_name: "Ama Mensah", status: "accepted", reason: "Nope" },
    current
  );
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /Unknown fields/);
});

test("11-14. Correction patch cannot include workflow fields", () => {
  const result = edit({ program: "Medicine" });
  for (const forbidden of [
    "status",
    "submitted_at",
    "overall_score",
    "recommendation",
    "user_id",
    "concept_note_path",
  ]) {
    assert.equal(result.patch[forbidden], undefined);
  }
  const route = readFileSync(
    resolve("app/api/director/applications/[id]/details/route.js"),
    "utf8"
  );
  assert.doesNotMatch(route, /application_assessments/);
  assert.doesNotMatch(route, /assessor_assignments/);
  assert.doesNotMatch(route, /sendKspEmail/);
});

test("15. Audit event records the correction", () => {
  assert.ok(DIRECTOR_AUDIT_ACTIONS.includes("application.details_corrected"));
  const route = readFileSync(
    resolve("app/api/director/applications/[id]/details/route.js"),
    "utf8"
  );
  assert.match(route, /application\.details_corrected|APPLICANT_DETAILS_CORRECTION_ACTION/);
  assert.match(route, /reason: correction\.reason/);
  assert.match(route, /oldValue: correction\.oldValue/);
  assert.match(route, /critical: true/);
  assert.match(route, /could not be recorded/);
});

test("16. Name synchronization is requested only when the name changes", () => {
  assert.equal(edit({ full_name: "Ama K. Mensah" }).syncProfileName, true);
  assert.equal(edit({ hometown: "Ho" }).syncProfileName, false);
  const route = readFileSync(
    resolve("app/api/director/applications/[id]/details/route.js"),
    "utf8"
  );
  assert.match(route, /profiles/);
  assert.match(route, /full_name: correction\.patch\.full_name/);
});

test("17. Demographics reflect corrected gender", () => {
  const before = aggregateDirectorDemographics([{ gender: "female", university: "A", region: "Ashanti" }]);
  const after = aggregateDirectorDemographics([{ gender: "male", university: "A", region: "Ashanti" }]);
  assert.equal(before.gender.female, 1);
  assert.equal(after.gender.male, 1);
  assert.equal(after.gender.female, 0);
});

test("18. Existing returnTo navigation remains functional", () => {
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(page, /resolveDirectorApplicationsReturnTo/);
  assert.match(page, /backToApplicationsHref/);
  assert.match(page, /DirectorEditApplicantDetails/);
  const editor = readFileSync(
    resolve("components/director/DirectorEditApplicantDetails.jsx"),
    "utf8"
  );
  assert.match(editor, /Edit Details/);
});

test("19. Repeated clicks are blocked while saving", () => {
  const ui = readFileSync(
    resolve("components/director/DirectorEditApplicantDetails.jsx"),
    "utf8"
  );
  assert.match(ui, /if \(saving\) return/);
  assert.match(ui, /disabled=\{saving\}/);
});

test("20. Failed updates do not report success", () => {
  const route = readFileSync(
    resolve("app/api/director/applications/[id]/details/route.js"),
    "utf8"
  );
  assert.match(route, /Could not save the correction/);
  assert.match(route, /if \(!audit\.ok\)/);
  const successAfterAudit = route.indexOf("success: true");
  const auditCheck = route.indexOf("if (!audit.ok)");
  assert.ok(auditCheck > 0 && successAfterAudit > auditCheck);
});

test("historical university values are preserved when unchanged", () => {
  const legacy = { ...current, university: "A small college not listed" };
  const result = edit({ hometown: "Cape Coast" }, legacy);
  assert.equal(result.patch.university, undefined);
  assert.equal(result.ok, true);
});

test("reason is required", () => {
  const result = buildApplicantDetailsCorrection(
    { full_name: "New Name", gender: "female" },
    current
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /reason/i);
});
