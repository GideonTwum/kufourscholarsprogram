import Link from "next/link";
import { buildDirectorApplicationsListHref } from "@/lib/director-applications-return";

/**
 * Selected-assessor workload plus Assessment Status shortcuts.
 * Buttons set the existing `workflow` query (assessed / assigned / all).
 * Counts are the assessor's full active-assignment population.
 *
 * @param {{
 *   summary: {
 *     assessorId: string,
 *     name: string,
 *     isActive: boolean,
 *     total: number,
 *     assessed: number,
 *     awaiting: number,
 *     other?: number,
 *   }|null,
 *   workflowFilter?: string,
 *   statusFilter?: string,
 *   stageFilter?: string,
 *   searchQuery?: string,
 * }} props
 */
export default function DirectorAssessorSummary({
  summary,
  workflowFilter = "all",
  statusFilter = "",
  stageFilter = "all",
  searchQuery = "",
}) {
  if (!summary) return null;

  const plural = summary.total === 1 ? "applicant" : "applicants";
  const other =
    typeof summary.other === "number"
      ? summary.other
      : Math.max(0, summary.total - summary.assessed - summary.awaiting);

  function hrefForWorkflow(workflow) {
    return buildDirectorApplicationsListHref({
      status: statusFilter,
      workflow,
      stage: stageFilter,
      assessor: summary.assessorId,
      q: searchQuery,
    });
  }

  const options = [
    { key: "all", label: "All", count: summary.total, workflow: "all" },
    { key: "assessed", label: "Assessed", count: summary.assessed, workflow: "assessed" },
    {
      key: "awaiting",
      label: "Awaiting Assessment",
      count: summary.awaiting,
      workflow: "assigned",
    },
  ];

  return (
    <div className="mb-4 rounded-lg border border-royal/15 bg-royal/5 px-4 py-3">
      <p className="text-sm font-semibold text-gray-900">
        {summary.name}
        {!summary.isActive ? (
          <span className="ml-2 text-xs font-medium text-amber-700">Inactive</span>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-gray-700">
        {summary.total} assigned {plural}
      </p>
      <p className="mt-0.5 text-xs text-gray-600">
        {summary.assessed} assessed · {summary.awaiting} awaiting assessment
        {other > 0
          ? ` · ${other} interview or final-outcome ${other === 1 ? "application" : "applications"}`
          : ""}
      </p>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-gray-500" id="assessor-assessment-status-label">
          Assessment Status
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="assessor-assessment-status-label"
        >
          {options.map((option) => {
            const selected = (workflowFilter || "all") === option.workflow;
            return (
              <Link
                key={option.key}
                href={hrefForWorkflow(option.workflow)}
                aria-current={selected ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-royal text-white ring-2 ring-royal/30 ring-offset-1"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {option.label} ({option.count})
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
