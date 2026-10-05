"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Assessor filter dropdown for Director Applications.
 * Navigates with ?assessor=<uuid>; UUIDs are never shown as labels.
 *
 * @param {{
 *   options: Array<{ id: string, name: string, isActive: boolean, count: number }>,
 *   selectedId: string,
 *   statusFilter?: string,
 *   workflowFilter?: string,
 *   stageFilter?: string,
 * }} props
 */
export default function DirectorAssessorFilter({
  options = [],
  selectedId = "",
  statusFilter = "",
  workflowFilter = "all",
  stageFilter = "all",
}) {
  const router = useRouter();
  const [nameQuery, setNameQuery] = useState("");
  const showSearch = options.length > 8;

  const filteredOptions = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, nameQuery]);

  function hrefForAssessor(assessorId) {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (workflowFilter && workflowFilter !== "all") params.set("workflow", workflowFilter);
    if (stageFilter && stageFilter !== "all") params.set("stage", stageFilter);
    if (assessorId) params.set("assessor", assessorId);
    const qs = params.toString();
    return qs ? `/director/applications?${qs}` : "/director/applications";
  }

  const optionLabel = (o) => {
    const base = `${o.name} (${o.count})`;
    return o.isActive ? base : `${o.name} — Inactive (${o.count})`;
  };

  return (
    <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
        <label htmlFor="director-assessor-filter" className="text-xs font-medium text-gray-500">
          Assessor
        </label>
        <select
          id="director-assessor-filter"
          value={selectedId}
          onChange={(e) => router.push(hrefForAssessor(e.target.value))}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-royal focus:outline-none focus:ring-1 focus:ring-royal"
        >
          <option value="">All Assessors</option>
          {selectedId && !options.some((o) => o.id === selectedId) ? (
            <option value={selectedId}>Selected assessor (0)</option>
          ) : null}
          {(showSearch ? filteredOptions : options).map((o) => (
            <option key={o.id} value={o.id}>
              {optionLabel(o)}
            </option>
          ))}
          {/* Keep selected option visible even if name-search hid it */}
          {showSearch &&
          selectedId &&
          !filteredOptions.some((o) => o.id === selectedId) &&
          options.some((o) => o.id === selectedId)
            ? (() => {
                const o = options.find((x) => x.id === selectedId);
                return o ? (
                  <option key={`selected-${o.id}`} value={o.id}>
                    {optionLabel(o)}
                  </option>
                ) : null;
              })()
            : null}
        </select>
      </div>
      {showSearch ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
          <label htmlFor="director-assessor-name-search" className="text-xs font-medium text-gray-500">
            Find assessor
          </label>
          <input
            id="director-assessor-name-search"
            type="search"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Type assessor name…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-royal focus:outline-none focus:ring-1 focus:ring-royal"
            autoComplete="off"
          />
        </div>
      ) : null}
    </div>
  );
}
