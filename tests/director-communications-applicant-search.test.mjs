import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COMMUNICATION_APPLICATION_SELECT,
  COMMUNICATION_APPLICANT_SEARCH_FIELDS,
  COMMUNICATION_APPLICANT_SEARCH_LIMIT,
  COMMUNICATION_APPLICANT_SEARCH_MIN_CHARS,
  escapeIlikePattern,
  mapApplicationToApplicantSearchResult,
} from "../lib/director-communications.js";

test("applicant search select never uses applications.email", () => {
  assert.match(COMMUNICATION_APPLICATION_SELECT, /profiles!applications_user_id_fkey\(full_name, email\)/);
  assert.doesNotMatch(COMMUNICATION_APPLICATION_SELECT, /university, email,/);
  assert.doesNotMatch(COMMUNICATION_APPLICATION_SELECT, /,\s*email,/);
  assert.doesNotMatch(COMMUNICATION_APPLICATION_SELECT, /,\s*email$/);
});

test("mapApplicationToApplicantSearchResult returns only approved fields and skips drafts", () => {
  assert.equal(
    mapApplicationToApplicantSearchResult({
      id: "a1",
      status: "draft",
      full_name: "Hidden",
      profiles: { email: "h@example.com" },
    }),
    null
  );

  const mapped = mapApplicationToApplicantSearchResult({
    id: "a2",
    status: "stage_1_submitted",
    full_name: "Ama Mensah",
    university: "University of Ghana",
    profiles: { email: "ama@example.com", full_name: "Ama M" },
    phone: "should-not-appear",
    address: "should-not-appear",
  });
  assert.deepEqual(Object.keys(mapped).sort(), [...COMMUNICATION_APPLICANT_SEARCH_FIELDS].sort());
  assert.equal(mapped.application_id, "a2");
  assert.equal(mapped.full_name, "Ama Mensah");
  assert.equal(mapped.email, "ama@example.com");
  assert.equal(mapped.university, "University of Ghana");
  assert.equal(mapped.status, "stage_1_submitted");
  assert.equal(mapped.phone, undefined);
  assert.equal(mapped.address, undefined);
});

test("search helpers: ilike escape, min chars, limit", () => {
  assert.equal(escapeIlikePattern("a%b_c"), "a\\%b\\_c");
  assert.equal(COMMUNICATION_APPLICANT_SEARCH_MIN_CHARS, 2);
  assert.ok(COMMUNICATION_APPLICANT_SEARCH_LIMIT <= 20);
  assert.ok(COMMUNICATION_APPLICANT_SEARCH_LIMIT >= 10);
});

test("applicants API and UI wiring: Director-only search, no UUID field", () => {
  const routePath = resolve("app/api/director/communications/applicants/route.js");
  assert.equal(existsSync(routePath), true);
  const route = readFileSync(routePath, "utf8");
  assert.match(route, /requireActiveDirector/);
  assert.match(route, /searchCommunicationApplicants/);
  assert.match(route, /lookupCommunicationApplicantById/);
  assert.doesNotMatch(route, /applications\.email/);
  assert.match(route, /COMMUNICATION_APPLICATION_SELECT|searchCommunicationApplicants/);

  const lib = readFileSync(resolve("lib/director-communications.js"), "utf8");
  assert.match(lib, /applyDirectorOperationalScope/);
  assert.match(lib, /\.ilike\("email"/);
  assert.match(lib, /profiles/);
  assert.doesNotMatch(lib, /select\([^\)]*university, email,/);

  const ui = readFileSync(
    resolve("app/(dashboard)/director/communications/CommunicationsClient.jsx"),
    "utf8"
  );
  assert.match(ui, /Search applicant by name or email/);
  assert.match(ui, /application_id/);
  assert.match(ui, /selectApplicant/);
  assert.match(ui, /\/api\/director\/communications\/applicants/);
  assert.doesNotMatch(ui, /Application ID/);
  assert.doesNotMatch(ui, /Prefer Message Applicant from a detail page/);
  // Preview/send still pass application_id — not email as auth
  assert.match(ui, /application_id: audience === "individual" \? applicationId/);
});

test("individual resolver still independently loads by application_id", () => {
  const lib = readFileSync(resolve("lib/director-communications.js"), "utf8");
  assert.match(lib, /audience === "individual"/);
  assert.match(lib, /\.eq\("id", applicationId\)/);
  assert.match(lib, /status === "draft"/);
});
