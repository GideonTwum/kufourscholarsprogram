import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  aggregateDirectorDemographics,
  emptyDirectorDemographics,
  percentOf,
} from "../lib/director-demographics.js";
import { GHANA_REGIONS, GHANA_REGION_COUNT } from "../lib/ghana-regions.js";

test("percentOf avoids NaN and division by zero", () => {
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(5, 0), 0);
  assert.equal(percentOf(1, 4), 25);
  assert.equal(percentOf(1, 3), 33.3);
});

test("gender aggregation reconciles and uses known percentages", () => {
  const rows = [
    ...Array.from({ length: 200 }, () => ({ gender: "male", region: "Ashanti", university: "University of Ghana" })),
    ...Array.from({ length: 220 }, () => ({ gender: "female", region: "Greater Accra", university: "Ashesi University" })),
    ...Array.from({ length: 80 }, () => ({ gender: null, region: null, university: "KNUST" })),
  ];
  const d = aggregateDirectorDemographics(rows);
  assert.equal(d.totalSubmitted, 500);
  assert.equal(d.gender.male, 200);
  assert.equal(d.gender.female, 220);
  assert.equal(d.gender.missing, 80);
  assert.equal(d.gender.known, 420);
  assert.equal(d.gender.male + d.gender.female + d.gender.missing, d.totalSubmitted);
  assert.equal(d.gender.coveragePercentage, 84);
  assert.equal(d.gender.malePercentageOverall, 40);
  assert.equal(d.gender.femalePercentageOverall, 44);
  assert.equal(d.gender.malePercentageKnown, 47.6);
  assert.equal(d.gender.femalePercentageKnown, 52.4);
});

test("zero submitted applications returns empty safe demographics", () => {
  const d = emptyDirectorDemographics();
  assert.equal(d.totalSubmitted, 0);
  assert.equal(d.gender.malePercentageKnown, 0);
  assert.equal(d.regions.represented, 0);
  assert.equal(d.regions.total, GHANA_REGION_COUNT);
  assert.equal(d.universities.represented, 0);
  assert.deepEqual(d.regions.items, []);
  assert.deepEqual(d.universities.items, []);
});

test("region aggregation counts only canonical values; legacy is not guessed", () => {
  const rows = [
    { gender: "male", region: "Greater Accra", university: "A" },
    { gender: "male", region: "Greater Accra", university: "A" },
    { gender: "female", region: "Ashanti", university: "B" },
    { gender: "female", region: "Ashanti Region", university: "B" },
    { gender: "male", region: "ashanti", university: "C" },
    { gender: "male", region: "  ", university: "C" },
    { gender: "female", region: null, university: "D" },
    { gender: "female", region: "Western North", university: "D" },
  ];
  const d = aggregateDirectorDemographics(rows);
  assert.equal(d.totalSubmitted, 8);
  assert.equal(d.regions.known, 4);
  assert.equal(d.regions.missingOrLegacy, 4);
  assert.equal(d.regions.known + d.regions.missingOrLegacy, d.totalSubmitted);
  assert.equal(d.regions.represented, 3);
  assert.equal(d.regions.total, 16);
  assert.equal(GHANA_REGIONS.length, 16);

  const byName = Object.fromEntries(d.regions.items.map((i) => [i.name, i.count]));
  assert.equal(byName["Greater Accra"], 2);
  assert.equal(byName.Ashanti, 1);
  assert.equal(byName["Western North"], 1);
  assert.equal(byName["Ashanti Region"], undefined);

  assert.ok(d.regions.items.every((i) => GHANA_REGIONS.includes(i.name)));
  assert.ok(d.regions.items[0].count >= d.regions.items[1].count);
});

test("university aggregation trims whitespace, does not fuzzy-merge aliases, ranks stably", () => {
  const rows = [
    { gender: "male", region: "Ashanti", university: "University of Ghana" },
    { gender: "male", region: "Ashanti", university: "  University of Ghana  " },
    { gender: "female", region: "Ashanti", university: "UG" },
    { gender: "female", region: "Ashanti", university: "KNUST" },
    { gender: "male", region: "Ashanti", university: "KNUST" },
    { gender: "male", region: "Ashanti", university: "Ashesi University" },
    { gender: "female", region: "Ashanti", university: "" },
    { gender: "female", region: "Ashanti", university: null },
    { gender: "male", region: "Ashanti", university: "   " },
  ];
  const d = aggregateDirectorDemographics(rows);
  assert.equal(d.totalSubmitted, 9);
  assert.equal(d.universities.known, 6);
  assert.equal(d.universities.missing, 3);
  assert.equal(d.universities.known + d.universities.missing, d.totalSubmitted);
  assert.equal(d.universities.represented, 4);

  const names = d.universities.items.map((i) => i.name);
  assert.equal(names[0], "KNUST");
  assert.equal(d.universities.items[0].count, 2);
  assert.equal(names[1], "University of Ghana");
  assert.ok(names.includes("UG"));
  assert.ok(!names.some((n) => n !== n.trim()));

  // Tie: Ashesi University vs UG both count 1 — alphabetical after higher ranks
  const tieNames = d.universities.items.filter((i) => i.count === 1).map((i) => i.name);
  assert.deepEqual(tieNames, [...tieNames].sort((a, b) => a.localeCompare(b)));
});

test("demographics API uses director auth, operational scope, and minimal columns", () => {
  const src = readFileSync(resolve("app/api/director/demographics/route.js"), "utf8");
  assert.match(src, /requireActiveDirector/);
  assert.match(src, /applyDirectorOperationalScope/);
  assert.match(src, /fetchAllApplicationPages/);
  assert.match(src, /aggregateDirectorDemographics/);
  assert.match(src, /select\("gender, region, university"\)/);
  assert.doesNotMatch(src, /email|phone|address|date_of_birth|student_id_path/);
  assert.doesNotMatch(src, /\.update\(|\.insert\(|\.delete\(/);
});

test("director dashboard mounts demographics section without Prefer not to say", () => {
  const page = readFileSync(resolve("app/(dashboard)/director/page.js"), "utf8");
  assert.match(page, /ApplicantDemographicsReach/);

  const ui = readFileSync(
    resolve("components/director/ApplicantDemographicsReach.jsx"),
    "utf8"
  );
  assert.match(ui, /Applicant Demographics/);
  assert.match(ui, /\/api\/director\/demographics/);
  assert.match(ui, /Historical \/ Missing Data/);
  assert.match(ui, /View all institutions/);
  assert.match(ui, /Data coverage/);
  assert.doesNotMatch(ui, /Prefer not to say/i);
  assert.doesNotMatch(ui, /recharts|chart\.js|Chart\.js/i);
});

test("security ops list includes demographics route", () => {
  const security = readFileSync(resolve("tests/director-security-operations.test.mjs"), "utf8");
  assert.match(security, /director\/demographics\/route\.js/);
});
