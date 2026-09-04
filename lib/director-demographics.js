/**
 * Director demographics analytics — pure aggregation over operational applications.
 * Scope: status != draft (same as Submitted applications). Read-only; no PII beyond aggregates.
 */

import {
  GHANA_REGIONS,
  GHANA_REGION_COUNT,
  isCanonicalGhanaRegion,
} from "./ghana-regions.js";

/**
 * Safe percentage (0–100). Avoids NaN / Infinity.
 * @param {number} part
 * @param {number} whole
 * @param {number} [decimals=1]
 */
export function percentOf(part, whole, decimals = 1) {
  const p = Number(part) || 0;
  const w = Number(whole) || 0;
  if (w <= 0) return 0;
  const raw = (p / w) * 100;
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}

/**
 * @param {{ gender?: string|null, region?: string|null, university?: string|null }[]} rows
 */
export function aggregateDirectorDemographics(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const totalSubmitted = list.length;

  let male = 0;
  let female = 0;
  let genderMissing = 0;

  /** @type {Map<string, number>} */
  const regionCounts = new Map();
  for (const name of GHANA_REGIONS) regionCounts.set(name, 0);
  let regionKnown = 0;
  let regionMissingOrLegacy = 0;

  /** @type {Map<string, number>} */
  const universityCounts = new Map();
  let universityKnown = 0;
  let universityMissing = 0;

  for (const row of list) {
    const g = typeof row?.gender === "string" ? row.gender.trim().toLowerCase() : "";
    if (g === "male") male += 1;
    else if (g === "female") female += 1;
    else genderMissing += 1;

    const regionRaw = typeof row?.region === "string" ? row.region.trim() : "";
    if (regionRaw && isCanonicalGhanaRegion(regionRaw)) {
      regionKnown += 1;
      regionCounts.set(regionRaw, (regionCounts.get(regionRaw) || 0) + 1);
    } else {
      regionMissingOrLegacy += 1;
    }

    const uniRaw = typeof row?.university === "string" ? row.university.trim().replace(/\s+/g, " ") : "";
    if (uniRaw) {
      universityKnown += 1;
      universityCounts.set(uniRaw, (universityCounts.get(uniRaw) || 0) + 1);
    } else {
      universityMissing += 1;
    }
  }

  const genderKnown = male + female;

  const regionItems = GHANA_REGIONS.map((name) => {
    const count = regionCounts.get(name) || 0;
    return {
      name,
      count,
      percentageOverall: percentOf(count, totalSubmitted),
      percentageKnown: percentOf(count, regionKnown),
    };
  })
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

  const regionsRepresented = regionItems.length;

  const universityItems = [...universityCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      percentageOverall: percentOf(count, totalSubmitted),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

  return {
    totalSubmitted,
    gender: {
      male,
      female,
      missing: genderMissing,
      known: genderKnown,
      coveragePercentage: percentOf(genderKnown, totalSubmitted),
      malePercentageOverall: percentOf(male, totalSubmitted),
      femalePercentageOverall: percentOf(female, totalSubmitted),
      missingPercentageOverall: percentOf(genderMissing, totalSubmitted),
      malePercentageKnown: percentOf(male, genderKnown),
      femalePercentageKnown: percentOf(female, genderKnown),
    },
    regions: {
      represented: regionsRepresented,
      total: GHANA_REGION_COUNT,
      known: regionKnown,
      missingOrLegacy: regionMissingOrLegacy,
      coveragePercentage: percentOf(regionKnown, totalSubmitted),
      items: regionItems,
    },
    universities: {
      represented: universityItems.length,
      known: universityKnown,
      missing: universityMissing,
      coveragePercentage: percentOf(universityKnown, totalSubmitted),
      items: universityItems,
    },
  };
}

/**
 * Empty payload when there are no operational applications.
 */
export function emptyDirectorDemographics() {
  return aggregateDirectorDemographics([]);
}
