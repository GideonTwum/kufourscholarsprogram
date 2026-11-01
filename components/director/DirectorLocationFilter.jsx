"use client";

import { useRouter } from "next/navigation";
import { buildDirectorApplicationsListHref } from "@/lib/director-applications-return";
import { DIRECTOR_REGION_FILTERS, DIRECTOR_TOWN_FILTERS } from "@/lib/director-location-filter";

/**
 * Region / town dropdowns. Town uses current_town only (never hometown).
 */
export default function DirectorLocationFilter({
  statusFilter = "",
  workflowFilter = "all",
  stageFilter = "all",
  stage2Filter = "",
  assessorFilter = "",
  regionFilter = "",
  townFilter = "",
  allocFilter = "",
  idateFilter = "",
  searchQuery = "",
}) {
  const router = useRouter();

  function hrefWith(overrides) {
    return buildDirectorApplicationsListHref({
      status: statusFilter,
      workflow: workflowFilter,
      stage: stageFilter,
      stage2: stage2Filter,
      assessor: assessorFilter,
      region: regionFilter,
      town: townFilter,
      alloc: allocFilter,
      idate: idateFilter,
      q: searchQuery,
      ...overrides,
    });
  }

  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs">
        <label htmlFor="director-region-filter" className="text-xs font-medium text-gray-500">
          Current region
        </label>
        <select
          id="director-region-filter"
          value={regionFilter}
          onChange={(e) => router.push(hrefWith({ region: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-royal focus:outline-none focus:ring-1 focus:ring-royal"
        >
          {DIRECTOR_REGION_FILTERS.map(({ key, label }) => (
            <option key={key || "all-regions"} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:max-w-xs">
        <label htmlFor="director-town-filter" className="text-xs font-medium text-gray-500">
          Town / city
        </label>
        <select
          id="director-town-filter"
          value={townFilter}
          onChange={(e) => router.push(hrefWith({ town: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-royal focus:outline-none focus:ring-1 focus:ring-royal"
        >
          {DIRECTOR_TOWN_FILTERS.map(({ key, label }) => (
            <option key={key || "all-towns"} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-400">
          Current town is shown only when recorded. Hometown is not used.
        </p>
      </div>
    </div>
  );
}
