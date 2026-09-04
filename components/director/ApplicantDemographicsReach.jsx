"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return "0%";
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-gray-500">{hint}</p> : null}
    </div>
  );
}

function CoverageRow({ label, known, total, percentage }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-50 py-2 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">
          {known} of {total}
        </span>{" "}
        applications ({formatPct(percentage)})
      </span>
    </div>
  );
}

function GenderBar({ label, count, percentageKnown, maxKnown, tone }) {
  const width =
    maxKnown > 0 ? Math.max(0, Math.min(100, (count / maxKnown) * 100)) : 0;
  const barClass = tone === "female" ? "bg-royal" : "bg-gold";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">
          {label}{" "}
          <span className="font-normal text-gray-500">({count})</span>
        </p>
        <p className="text-sm font-medium text-gray-700">
          {formatPct(percentageKnown)} of applicants with gender data
        </p>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={maxKnown || 0}
        aria-label={`${label}: ${count} applicants, ${formatPct(percentageKnown)} of known gender records`}
      >
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RegionBar({ name, count, percentageOverall, maxCount }) {
  const width = maxCount > 0 ? Math.max(0, Math.min(100, (count / maxCount) * 100)) : 0;
  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-medium text-gray-900">{name}</span>
        <span className="shrink-0 text-sm text-gray-600">
          {count} · {formatPct(percentageOverall)}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={maxCount || 0}
        aria-label={`${name}: ${count} applicants, ${formatPct(percentageOverall)} of submitted applications`}
      >
        <div className="h-full rounded-full bg-royal" style={{ width: `${width}%` }} />
      </div>
    </li>
  );
}

/**
 * Director dashboard section: Applicant Demographics & Reach.
 * Fetches aggregate-only data from /api/director/demographics.
 */
export default function ApplicantDemographicsReach() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllUniversities, setShowAllUniversities] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/director/demographics");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load demographics");
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Failed to load demographics");
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.totalSubmitted ?? 0;
  const gender = data?.gender;
  const regions = data?.regions;
  const universities = data?.universities;
  const regionMax = regions?.items?.[0]?.count || 0;
  const genderMaxKnown = Math.max(gender?.male || 0, gender?.female || 0);
  const universityRows = universities?.items || [];
  const visibleUniversities = showAllUniversities
    ? universityRows
    : universityRows.slice(0, 10);

  return (
    <section
      aria-labelledby="demographics-reach-heading"
      className="mb-10"
      data-demographics-section="true"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="demographics-reach-heading"
            className="text-sm font-bold uppercase tracking-wide text-gray-500"
          >
            Applicant Demographics &amp; Reach
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Understand the demographic and geographic reach of submitted applications.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Refresh demographics
        </button>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-gray-100 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-royal" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Male Applicants"
              value={gender.male}
              hint={
                gender.known > 0
                  ? `${formatPct(gender.malePercentageKnown)} of applicants with gender data`
                  : "No gender data available yet"
              }
            />
            <SummaryCard
              label="Female Applicants"
              value={gender.female}
              hint={
                gender.known > 0
                  ? `${formatPct(gender.femalePercentageKnown)} of applicants with gender data`
                  : "No gender data available yet"
              }
            />
            <SummaryCard
              label="Regions Represented"
              value={`${regions.represented} / ${regions.total}`}
              hint={`${regions.known} applications with canonical region data`}
            />
            <SummaryCard
              label="Institutions Represented"
              value={universities.represented}
              hint={`${universities.known} applications with university data`}
            />
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900">Data coverage</h3>
            <p className="mt-1 text-xs text-gray-500">
              Based on {total} submitted application{total === 1 ? "" : "s"} (excludes drafts).
              Historical rows may lack structured demographics.
            </p>
            <div className="mt-3">
              <CoverageRow
                label="Gender data available"
                known={gender.known}
                total={total}
                percentage={gender.coveragePercentage}
              />
              <CoverageRow
                label="Region data available"
                known={regions.known}
                total={total}
                percentage={regions.coveragePercentage}
              />
              <CoverageRow
                label="University data available"
                known={universities.known}
                total={total}
                percentage={universities.coveragePercentage}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900">Gender</h3>
              {gender.known === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No gender data is available yet.</p>
              ) : (
                <div className="mt-4 space-y-5">
                  <GenderBar
                    label="Male"
                    count={gender.male}
                    percentageKnown={gender.malePercentageKnown}
                    maxKnown={genderMaxKnown}
                    tone="male"
                  />
                  <GenderBar
                    label="Female"
                    count={gender.female}
                    percentageKnown={gender.femalePercentageKnown}
                    maxKnown={genderMaxKnown}
                    tone="female"
                  />
                </div>
              )}
              <p className="mt-5 text-sm text-gray-600">
                Historical / Missing Data:{" "}
                <span className="font-semibold text-gray-900">{gender.missing}</span>
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">Regional distribution</h3>
                <p className="text-xs text-gray-500">
                  Regions represented: {regions.represented} of {regions.total}
                </p>
              </div>
              {regions.items.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No regional data is available yet.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {regions.items.map((item) => (
                    <RegionBar
                      key={item.name}
                      name={item.name}
                      count={item.count}
                      percentageOverall={item.percentageOverall}
                      maxCount={regionMax}
                    />
                  ))}
                </ul>
              )}
              <p className="mt-5 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                Historical / unstructured region data:{" "}
                <span className="font-semibold">{regions.missingOrLegacy}</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {showAllUniversities ? "All institutions" : "Top 10 institutions"}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Institutions represented: {universities.represented}
                  {universities.missing > 0
                    ? ` · Missing university data: ${universities.missing}`
                    : ""}
                </p>
              </div>
              {universityRows.length > 10 ? (
                <button
                  type="button"
                  onClick={() => setShowAllUniversities((v) => !v)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-royal hover:bg-royal/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
                >
                  {showAllUniversities ? "Show less" : "View all institutions"}
                </button>
              ) : null}
            </div>

            {universityRows.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No institution data is available yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Rank
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Institution
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Applicants
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUniversities.map((item, index) => (
                      <tr key={item.name} className="border-b border-gray-50">
                        <td className="py-2.5 pr-3 tabular-nums text-gray-500">{index + 1}</td>
                        <td className="max-w-[14rem] break-words py-2.5 pr-3 font-medium text-gray-900 sm:max-w-none">
                          {item.name}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-gray-700">{item.count}</td>
                        <td className="py-2.5 tabular-nums text-gray-700">
                          {formatPct(item.percentageOverall)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
