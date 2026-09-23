import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  normalizeAssessorSearchQuery,
  assessorApplicantSearchHaystack,
  filterAssessorApplicationsBySearch,
} from "../lib/assessor-applicant-search.js";

function assignedApp({
  id = "app-1",
  fullName = "Juliana Adenkia",
  email = "juliana@example.com",
  university = "University of Ghana",
  studentId = "UG-2024-001",
} = {}) {
  return {
    id,
    full_name: fullName,
    university,
    student_id: studentId,
    application: {
      id,
      full_name: fullName,
      university,
      student_id: studentId,
      applicant: {
        full_name: fullName,
        email,
      },
    },
    profiles: {
      full_name: fullName,
      email,
    },
  };
}

const ASSIGNED = [
  assignedApp({
    id: "a1",
    fullName: "Juliana Adenkia",
    email: "juliana@example.com",
    university: "University of Ghana",
    studentId: "UG-100",
  }),
  assignedApp({
    id: "a2",
    fullName: "Sheila Mensah",
    email: "sheila.m@school.edu",
    university: "Kwame Nkrumah University of Science and Technology",
    studentId: "KN-200",
  }),
  assignedApp({
    id: "a3",
    fullName: "Kwame Boateng",
    email: "kwame@example.org",
    university: "University of Cape Coast",
    studentId: "UCC-300",
  }),
];

test("normalizeAssessorSearchQuery trims whitespace", () => {
  assert.equal(normalizeAssessorSearchQuery("  juliana  "), "juliana");
  assert.equal(normalizeAssessorSearchQuery("   "), "");
  assert.equal(normalizeAssessorSearchQuery(null), "");
  assert.equal(normalizeAssessorSearchQuery(undefined), "");
});

test("search by full name", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "Juliana Adenkia");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a1");
});

test("search by partial name", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "aden");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a1");
});

test("case-insensitive search", () => {
  const lower = filterAssessorApplicationsBySearch(ASSIGNED, "juliana");
  const upper = filterAssessorApplicationsBySearch(ASSIGNED, "JULIANA");
  assert.equal(lower.length, 1);
  assert.equal(upper.length, 1);
  assert.equal(lower[0].id, upper[0].id);
});

test("search by email", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "sheila.m@school");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a2");
});

test("search by institution", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "university of ghana");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a1");
});

test("search by student id when already in assessor payload", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "UCC-300");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a3");
});

test("leading and trailing whitespace are ignored", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "  Juliana  ");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a1");
});

test("empty search returns normal assigned list", () => {
  assert.deepEqual(filterAssessorApplicationsBySearch(ASSIGNED, ""), ASSIGNED);
  assert.deepEqual(filterAssessorApplicationsBySearch(ASSIGNED, "   "), ASSIGNED);
});

test("no match returns empty list (search empty state)", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "zzzz-not-assigned");
  assert.equal(result.length, 0);
});

test("clearing search (empty query) restores full assigned list", () => {
  const filtered = filterAssessorApplicationsBySearch(ASSIGNED, "Sheila");
  assert.equal(filtered.length, 1);
  const restored = filterAssessorApplicationsBySearch(ASSIGNED, "");
  assert.equal(restored.length, ASSIGNED.length);
});

test("search only operates on the provided assigned population (scope boundary)", () => {
  // Simulate: another assessor's applicant is NOT in this assessor's list payload.
  const otherAssessorApp = assignedApp({
    id: "other-assessor-app",
    fullName: "Secret Applicant",
    email: "secret@elsewhere.edu",
    university: "Hidden University",
  });
  const scoped = ASSIGNED; // what API would return for this assessor
  const result = filterAssessorApplicationsBySearch(scoped, "Secret Applicant");
  assert.equal(result.length, 0);
  // Confirm the outsider would match if (incorrectly) included in the population
  assert.equal(
    filterAssessorApplicationsBySearch([otherAssessorApp], "Secret Applicant").length,
    1
  );
});

test("unassigned applicant is not findable when absent from assigned list", () => {
  const result = filterAssessorApplicationsBySearch(ASSIGNED, "Unassigned Person");
  assert.equal(result.length, 0);
});

test("haystack uses assessor-safe name/email/university/student_id fields only", () => {
  const hay = assessorApplicantSearchHaystack(ASSIGNED[0]);
  assert.match(hay, /juliana adenkia/);
  assert.match(hay, /juliana@example\.com/);
  assert.match(hay, /university of ghana/);
  assert.match(hay, /ug-100/);
  assert.doesNotMatch(hay, /director_notes|rejection_reason|interview_date/);
});

test("assessor list API still enforces assignment scope before any client search", () => {
  const src = readFileSync(resolve("app/api/assessor/applications/route.js"), "utf8");
  assert.match(src, /requireActiveAssessor/);
  assert.match(src, /eq\("assessor_id", assessorId\)/);
  assert.match(src, /eq\("status", "active"\)/);
  // No global applications search endpoint for assessors
  assert.doesNotMatch(src, /searchParams|ilike|\.or\(/);
});

test("assessor detail route independently checks assignment (search is not auth)", () => {
  const src = readFileSync(resolve("app/api/assessor/applications/[id]/route.js"), "utf8");
  assert.match(src, /requireActiveAssessor/);
  assert.match(src, /requireAssignment|Not assigned to this application/);
  assert.match(src, /eq\("assessor_id"/);
  assert.match(src, /eq\("status", "active"\)/);
});

test("assessor dashboard search UI: empty assignment vs no-match messaging", () => {
  const src = readFileSync(resolve("app/(dashboard)/assessor/page.js"), "utf8");
  assert.match(src, /filterAssessorApplicationsBySearch/);
  assert.match(src, /No applications have been assigned to you yet/);
  assert.match(src, /No assigned applicants match your search/);
  assert.match(src, /Clear search/);
  assert.match(src, /Search applicants by name, email or institution/);
  assert.match(src, /Showing \$\{filteredApplications\.length\} of \$\{applications\.length\} assigned applicants/);
  assert.doesNotMatch(src, /Applicant does not exist/);
  // Links still use existing assessor detail route
  assert.match(src, /href=\{`\/assessor\/\$\{app\.id/);
});

test("inactive / non-assessor cannot use list API (existing gate reused)", () => {
  const auth = readFileSync(resolve("lib/director-auth.js"), "utf8");
  assert.match(auth, /export async function requireActiveAssessor/);
  assert.match(auth, /ACCOUNT_DEACTIVATED/);
  assert.match(auth, /prof\.role !== "assessor"/);
  const api = readFileSync(resolve("app/api/assessor/applications/route.js"), "utf8");
  assert.match(api, /requireActiveAssessor/);
});

test("dashboard does not paginate — search covers full assigned population", () => {
  const api = readFileSync(resolve("app/api/assessor/applications/route.js"), "utf8");
  const page = readFileSync(resolve("app/(dashboard)/assessor/page.js"), "utf8");
  assert.doesNotMatch(api, /pageSize|offset|range\(/);
  assert.doesNotMatch(page, /pageSize|currentPage|pagination/);
  assert.match(page, /filterAssessorApplicationsBySearch\(applications, searchQuery\)/);
});
