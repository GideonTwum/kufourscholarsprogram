import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  STUDY_LOCATION_UNCONFIRMED_LABEL,
  currentTownDisplay,
  filterByDirectorStudyRegion,
  filterByDirectorStudyTown,
  filterByDirectorLocationConfirmation,
  hasLocationConfirmation,
  studyRegionKey,
  studyTownDisplay,
  virtualEligibilityForStudyRegion,
} from "../lib/director-location-filter.js";
import {
  INTERVIEW_LOCATION_CONFIRMATION_TABLE,
  confirmationRowForUpsert,
  persistInterviewLocationConfirmation,
  uniqueInterviewInstitutionOptions,
  uniqueInterviewTownOptions,
  validateInterviewLocationConfirmation,
} from "../lib/director-interview-location.js";
import { presentInterviewAllocationRow } from "../lib/director-interview-allocation.js";

function app(id, extra = {}) {
  return {
    id,
    status: extra.status ?? "stage_2_approved",
    full_name: extra.full_name || `Applicant ${id}`,
    university: extra.university || "University of Ghana",
    region: extra.region ?? "Greater Accra",
    hometown: extra.hometown ?? "Kumasi",
    current_town: extra.current_town ?? null,
    address: extra.address ?? "Kumasi, Ashanti, Ghana",
    interview_slot_id: extra.interview_slot_id ?? null,
    ...extra,
  };
}

function row(application, confirmation = null) {
  return { app: application, location_confirmation: confirmation };
}

const accra = app("accra");
const tamale = app("tamale", { region: "Northern", hometown: "Tamale", university: "UDS" });
const confirmedNorthern = row(tamale, {
  confirmed_region: "Northern",
  confirmed_town: "Yendi",
  study_institution: "UDS",
  study_region: "Northern",
  source: "director",
});
const studiedInAccra = row(tamale, {
  confirmed_region: "Greater Accra",
  confirmed_town: "Legon",
  study_institution: "University of Ghana",
  study_region: "Greater Accra",
  source: "director",
});

test("applied allocation migration is frozen, confirmation is forward-only", () => {
  const applied = readFileSync(
    resolve("supabase/migrations/202610300001_interview_allocation.sql"),
    "utf8"
  );
  assert.match(applied, /ALREADY APPLIED/);
  assert.doesNotMatch(applied, /application_interview_location_confirmations/);
  assert.ok(existsSync(resolve("supabase/migrations/202610300002_interview_location_confirmation.sql")));
  assert.ok(existsSync(resolve("supabase/migrations/202611010001_interview_timetable.sql")));
  assert.ok(existsSync(resolve("supabase/migrations/202611010002_interview_study_location.sql")));
  const next = readFileSync(
    resolve("supabase/migrations/202610300002_interview_location_confirmation.sql"),
    "utf8"
  );
  assert.match(next, /application_interview_location_confirmations/);
  assert.match(next, /UNIQUE \(application_id\)/);
  assert.match(next, /region and town\/city of STUDY/);
  assert.doesNotMatch(next, /UPDATE public\.applications/);
  const studySql = readFileSync(
    resolve("supabase/migrations/202611010002_interview_study_location.sql"),
    "utf8"
  );
  assert.match(studySql, /virtual_eligible_study_regions/);
  assert.doesNotMatch(studySql, /UPDATE public\.applications/);
  const editor = readFileSync(
    resolve("supabase-migration-interview-location-confirmation.sql"),
    "utf8"
  );
  assert.match(editor, /Do not apply to production automatically/);
});

test("study filters never use hometown or residential region", () => {
  assert.equal(studyTownDisplay(row(tamale)), STUDY_LOCATION_UNCONFIRMED_LABEL);
  assert.notEqual(tamale.hometown, studyTownDisplay(confirmedNorthern));
  assert.equal(studyTownDisplay(confirmedNorthern), "Yendi");
  assert.equal(studyRegionKey(row(tamale)), "unknown");
  assert.equal(studyRegionKey(confirmedNorthern), "Northern");
  const withTown = row(app("tema", { current_town: "Tema", hometown: "Kumasi", region: "Greater Accra" }));
  assert.equal(studyTownDisplay(withTown), STUDY_LOCATION_UNCONFIRMED_LABEL);
  const filtered = filterByDirectorStudyTown([row(tamale), confirmedNorthern, withTown], "Yendi");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].app.id, "tamale");
});

test("region of study filter ignores Stage 1 residential region", () => {
  const rows = [row(accra), studiedInAccra, confirmedNorthern];
  const accraRows = filterByDirectorStudyRegion(rows, "Greater Accra");
  assert.equal(accraRows.length, 1);
  assert.equal(accraRows[0].app.id, "tamale");
  assert.equal(filterByDirectorStudyRegion(rows, "Northern").length, 1);
});

test("unconfirmed applicants have no complete study-location row", () => {
  assert.equal(hasLocationConfirmation(row(accra)), false);
  assert.equal(hasLocationConfirmation(confirmedNorthern), true);
  assert.equal(
    hasLocationConfirmation(
      row(tamale, { confirmed_region: "Northern", confirmed_town: "Yendi", source: "director" })
    ),
    false
  );
  const unconfirmed = filterByDirectorLocationConfirmation(
    [row(accra), confirmedNorthern],
    "unconfirmed"
  );
  assert.equal(unconfirmed.length, 1);
  assert.equal(unconfirmed[0].app.id, "accra");
});

test("creating a confirmation requires study region, town, and institution", () => {
  const ok = validateInterviewLocationConfirmation({
    confirmedRegion: "Northern",
    confirmedTown: "  Tamale  ",
    studyInstitution: " UDS ",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.confirmed_town, "Tamale");
  assert.equal(ok.study_institution, "UDS");
  assert.equal(ok.study_region, "Northern");
  assert.equal(ok.confirmed_region, "Northern");
  const missingTown = validateInterviewLocationConfirmation({
    confirmedRegion: "Northern",
    confirmedTown: "  ",
    studyInstitution: "UDS",
  });
  assert.equal(missingTown.error, "study_town_required");
  const badRegion = validateInterviewLocationConfirmation({
    confirmedRegion: "Narnia",
    confirmedTown: "Tamale",
    studyInstitution: "UDS",
  });
  assert.equal(badRegion.error, "study_region_required");
  const missingInstitution = validateInterviewLocationConfirmation({
    confirmedRegion: "Northern",
    confirmedTown: "Tamale",
    source: "applicant",
  });
  assert.equal(missingInstitution.error, "study_institution_required");
});

test("persist writes confirmation table only", async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(table);
      return {
        upsert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: { application_id: "tamale" }, error: null }),
          }),
        }),
      };
    },
  };
  const validated = validateInterviewLocationConfirmation({
    confirmedRegion: "Northern",
    confirmedTown: "Yendi",
    studyInstitution: "UDS",
  });
  const result = await persistInterviewLocationConfirmation(client, {
    applicationId: "tamale",
    validated,
    actorId: "dir",
  });
  assert.equal(result.error, null);
  assert.equal(calls.includes("applications"), false);
  assert.equal(calls.includes(INTERVIEW_LOCATION_CONFIRMATION_TABLE), true);
  const upsert = confirmationRowForUpsert("tamale", validated, "dir");
  assert.equal(Object.prototype.hasOwnProperty.call(upsert, "status"), false);
  assert.equal(upsert.confirmed_town, "Yendi");
  assert.equal(upsert.study_region, "Northern");
});

test("presented allocation row uses study location and never hometown", () => {
  const presented = presentInterviewAllocationRow(studiedInAccra);
  assert.equal(presented.region, "Greater Accra");
  assert.equal(presented.town, "Legon");
  assert.equal(presented.study_institution, "University of Ghana");
  assert.equal(presented.location_confirmed, true);
  assert.notEqual(presented.town, tamale.hometown);
  const unconfirmed = presentInterviewAllocationRow(row(tamale));
  assert.equal(unconfirmed.town, STUDY_LOCATION_UNCONFIRMED_LABEL);
  assert.equal(unconfirmed.location_label, STUDY_LOCATION_UNCONFIRMED_LABEL);
  assert.equal(unconfirmed.location_confirmed, false);
  assert.notEqual(unconfirmed.region, tamale.region);
});

test("town and institution options exclude hometown and unconfirmed residence", () => {
  const options = uniqueInterviewTownOptions([row(tamale), confirmedNorthern, row(accra)]);
  const keys = options.map((item) => item.key);
  assert.ok(keys.includes("Yendi"));
  assert.ok(!keys.includes("Tamale"));
  assert.ok(!keys.includes("Kumasi"));
  const institutions = uniqueInterviewInstitutionOptions([row(tamale), confirmedNorthern]);
  assert.ok(institutions.some((item) => item.key === "UDS"));
});

test("virtual eligibility is configurable and never auto-approved", () => {
  const unset = virtualEligibilityForStudyRegion("Northern", []);
  assert.equal(unset.configured, false);
  assert.equal(unset.eligible, false);
  assert.equal(unset.autoApprove, false);
  const configured = virtualEligibilityForStudyRegion("Northern", ["Northern", "Upper East"]);
  assert.equal(configured.eligible, true);
  assert.equal(configured.autoApprove, false);
  const outside = virtualEligibilityForStudyRegion("Greater Accra", ["Northern"]);
  assert.equal(outside.eligible, false);
  assert.equal(outside.autoApprove, false);
});

test("location confirmation lives in Interviews, not Applications", () => {
  const allocUi = readFileSync(
    resolve("components/director/DirectorPublishedInterviews.jsx"),
    "utf8"
  );
  assert.match(allocUi, /Confirm study location/);
  assert.match(allocUi, /Region of study/);
  assert.match(allocUi, /Town\/city of study/);
  assert.match(allocUi, /Do not use hometown/);
  assert.doesNotMatch(allocUi, /DISTANT_GHANA_REGIONS\.join/);
  assert.match(allocUi, /\/api\/director\/interview-location-confirmations/);
  const apps = readFileSync(resolve("app/(dashboard)/director/applications/page.js"), "utf8");
  assert.doesNotMatch(apps, /interview-location-confirmations/);
});

test("location confirmation API is director-only and does not notify", () => {
  const api = readFileSync(
    resolve("app/api/director/interview-location-confirmations/route.js"),
    "utf8"
  );
  assert.match(api, /requireActiveDirector/);
  assert.doesNotMatch(api, /sendKspEmail/);
  assert.match(api, /notify_applicants: false/);
  assert.doesNotMatch(api, /from\("applications"\)\s*\.update/);
});

test("current_town helper still ignores hometown for Stage 1 data", () => {
  assert.equal(currentTownDisplay(tamale), "Not Provided");
});
