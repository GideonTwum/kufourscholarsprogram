import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DIRECTOR_APPLICATIONS_LIST_PATH,
  buildDirectorApplicationDetailHref,
  buildDirectorApplicationsListHref,
  resolveDirectorApplicationsReturnTo,
} from "../lib/director-applications-return.js";

const ASSESSOR_A = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function detailBack(listFilters) {
  const detail = buildDirectorApplicationDetailHref(APP_ID, listFilters);
  const url = new URL(detail, "http://local.invalid");
  assert.equal(url.pathname, `/director/applications/${APP_ID}`);
  return resolveDirectorApplicationsReturnTo(url.searchParams.get("returnTo"));
}

test("1. All Applications → detail → Back → All Applications", () => {
  assert.equal(detailBack({}), DIRECTOR_APPLICATIONS_LIST_PATH);
  assert.equal(detailBack({ workflow: "all", stage: "all" }), DIRECTOR_APPLICATIONS_LIST_PATH);
});

test("2. Assessed → detail → Back → Assessed", () => {
  assert.equal(
    detailBack({ workflow: "assessed" }),
    "/director/applications?workflow=assessed"
  );
});

test("3. Assigned → detail → Back → Assigned", () => {
  assert.equal(
    detailBack({ workflow: "assigned" }),
    "/director/applications?workflow=assigned"
  );
});

test("4. Unassigned → detail → Back → Unassigned", () => {
  assert.equal(
    detailBack({ workflow: "unassigned" }),
    "/director/applications?workflow=unassigned"
  );
});

test("5. Stage 1 → detail → Back → Stage 1", () => {
  assert.equal(
    detailBack({ stage: "stage_1" }),
    "/director/applications?stage=stage_1"
  );
});

test("6. Stage 2 → detail → Back → Stage 2", () => {
  assert.equal(
    detailBack({ stage: "stage_2" }),
    "/director/applications?stage=stage_2"
  );
});

test("7. Pending → detail → Back → Pending", () => {
  assert.equal(
    detailBack({ status: "pending" }),
    "/director/applications?status=pending"
  );
});

test("8. Assessor A → detail → Back → Assessor A", () => {
  assert.equal(
    detailBack({ assessor: ASSESSOR_A }),
    `/director/applications?assessor=${ASSESSOR_A}`
  );
});

test("9. Assessor A + Assessed → detail → Back preserves both", () => {
  const back = detailBack({ assessor: ASSESSOR_A, workflow: "assessed" });
  const params = new URL(back, "http://local.invalid").searchParams;
  assert.equal(params.get("assessor"), ASSESSOR_A);
  assert.equal(params.get("workflow"), "assessed");
});

test("10. Stage 2 + Assessor + Assessed → preserves all three", () => {
  const back = detailBack({
    stage: "stage_2",
    assessor: ASSESSOR_A,
    workflow: "assessed",
  });
  const params = new URL(back, "http://local.invalid").searchParams;
  assert.equal(params.get("stage"), "stage_2");
  assert.equal(params.get("assessor"), ASSESSOR_A);
  assert.equal(params.get("workflow"), "assessed");
});

test("11. Stage + Workflow + Status + Assessor → preserves all", () => {
  const back = detailBack({
    stage: "stage_1",
    workflow: "assessed",
    status: "pending",
    assessor: ASSESSOR_A,
  });
  const params = new URL(back, "http://local.invalid").searchParams;
  assert.equal(params.get("stage"), "stage_1");
  assert.equal(params.get("workflow"), "assessed");
  assert.equal(params.get("status"), "pending");
  assert.equal(params.get("assessor"), ASSESSOR_A);
});

test("12. Search preserved when URL-backed via q", () => {
  const back = detailBack({
    workflow: "assessed",
    assessor: ASSESSOR_A,
    q: "Daniela",
  });
  const params = new URL(back, "http://local.invalid").searchParams;
  assert.equal(params.get("q"), "Daniela");
  assert.equal(params.get("workflow"), "assessed");
  assert.equal(params.get("assessor"), ASSESSOR_A);
});

test("13. Pagination not invented when absent", () => {
  const href = buildDirectorApplicationsListHref({ workflow: "assessed" });
  assert.doesNotMatch(href, /page=/);
  const back = detailBack({ workflow: "assessed" });
  assert.doesNotMatch(back, /page=/);
});

test("14. Invalid returnTo falls back safely", () => {
  assert.equal(resolveDirectorApplicationsReturnTo(""), DIRECTOR_APPLICATIONS_LIST_PATH);
  assert.equal(resolveDirectorApplicationsReturnTo(null), DIRECTOR_APPLICATIONS_LIST_PATH);
  assert.equal(
    resolveDirectorApplicationsReturnTo("/director/settings"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
  assert.equal(
    resolveDirectorApplicationsReturnTo(`/director/applications/${APP_ID}`),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
});

test("15. External returnTo is rejected", () => {
  assert.equal(
    resolveDirectorApplicationsReturnTo("https://example.com"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
  assert.equal(
    resolveDirectorApplicationsReturnTo("https://example.com/director/applications"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
  assert.equal(
    resolveDirectorApplicationsReturnTo("http://evil.test?workflow=assessed"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
});

test("16. Protocol-relative external URL is rejected", () => {
  assert.equal(
    resolveDirectorApplicationsReturnTo("//example.com"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
  assert.equal(
    resolveDirectorApplicationsReturnTo("//example.com/director/applications"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
});

test("17. Directly opened application falls back to /director/applications", () => {
  assert.equal(resolveDirectorApplicationsReturnTo(undefined), DIRECTOR_APPLICATIONS_LIST_PATH);
  assert.equal(
    resolveDirectorApplicationsReturnTo("/director"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
});

test("18. Detail page refresh keeps returnTo in URL (wiring)", () => {
  const detail = buildDirectorApplicationDetailHref(APP_ID, {
    workflow: "assessed",
    assessor: ASSESSOR_A,
  });
  // returnTo remains a query param on the detail URL — refresh preserves it.
  assert.match(detail, /returnTo=/);
  assert.match(detail, /workflow%3Dassessed|workflow=assessed/);
  const page = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  assert.match(page, /useSearchParams/);
  assert.match(page, /resolveDirectorApplicationsReturnTo/);
  assert.match(page, /backToApplicationsHref/);
  // Local tabs must not navigate away from returnTo
  assert.match(page, /activeTab/);
  assert.doesNotMatch(page, /router\.push\(`\/director\/applications\/\$\{/);
});

test("19. Existing Director authorization unchanged", () => {
  const listPage = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.match(listPage, /isDirectorRole/);
  assert.match(listPage, /director-login/);
  const detailPage = readFileSync(
    resolve("app/(dashboard)/director/applications/[id]/page.js"),
    "utf8"
  );
  // Detail remains a Director dashboard route (layout/auth); Back helper is path-only.
  assert.match(detailPage, /Back to Applications/);
});

test("20. Existing application filters unchanged / composed with return context", () => {
  const listPage = readFileSync(
    resolve("app/(dashboard)/director/applications/page.js"),
    "utf8"
  );
  assert.match(listPage, /buildDirectorApplicationsListHref/);
  assert.match(listPage, /filterByDirectorAssessor/);
  assert.match(listPage, /loadDirectorAssignmentWorkflowMeta/);
  assert.match(listPage, /params\?\.q/);

  const listUi = readFileSync(
    resolve("components/director/DirectorApplicationsList.jsx"),
    "utf8"
  );
  assert.match(listUi, /buildDirectorApplicationDetailHref/);
  assert.match(listUi, /initialSearchQuery/);
  // Must not use bare detail links without return context helper
  assert.doesNotMatch(listUi, /href=\{`\/director\/applications\/\$\{app\.id\}`\}/);
});

test("javascript: and other schemes rejected", () => {
  assert.equal(
    resolveDirectorApplicationsReturnTo("javascript:alert(1)"),
    DIRECTOR_APPLICATIONS_LIST_PATH
  );
  assert.equal(
    resolveDirectorApplicationsReturnTo("/director/applications?workflow=assessed&evil=1"),
    "/director/applications?workflow=assessed"
  );
});

test("buildDirectorApplicationsListHref omits defaults", () => {
  assert.equal(buildDirectorApplicationsListHref({}), "/director/applications");
  assert.equal(
    buildDirectorApplicationsListHref({ workflow: "all", stage: "all", q: "  " }),
    "/director/applications"
  );
  assert.equal(
    buildDirectorApplicationsListHref({
      stage: "stage_1",
      workflow: "assessed",
      status: "pending",
      assessor: ASSESSOR_A,
      q: "Daniela",
    }),
    `/director/applications?status=pending&workflow=assessed&stage=stage_1&assessor=${ASSESSOR_A}&q=Daniela`
  );
});
