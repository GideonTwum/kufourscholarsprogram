/**
 * Compact workload summary when an Assessor filter is selected.
 * Numbers use Director workflow classifier semantics (current-stage assessed/assigned).
 *
 * @param {{
 *   summary: {
 *     name: string,
 *     isActive: boolean,
 *     total: number,
 *     assessed: number,
 *     awaiting: number,
 *   }|null,
 * }} props
 */
export default function DirectorAssessorSummary({ summary }) {
  if (!summary) return null;

  const plural = summary.total === 1 ? "applicant" : "applicants";

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
      </p>
    </div>
  );
}
