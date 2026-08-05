"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

export default function DirectorWorkflowGuide({ compact = false }) {
  const [open, setOpen] = useState(!compact);

  return (
    <div className="mb-6 rounded-xl border border-royal/15 bg-royal/5 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-royal">
          <Info size={16} />
          How applications, pending, and interviews work together
        </span>
        {open ? <ChevronUp size={16} className="text-royal" /> : <ChevronDown size={16} className="text-royal" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p>
            <strong className="text-gray-900">Applications → filters</strong> are inbox views only. They
            do not change an applicant&apos;s status.
          </p>
          <ul className="list-inside list-disc space-y-1.5 pl-1">
            <li>
              <strong>Pending</strong> — still in the pipeline (Stage 1 review, deferred, Stage 2, interview
              scheduling, etc.). Not accepted or rejected yet.
            </li>
            <li>
              <strong>Accepted / Rejected</strong> — final outcomes only.
            </li>
          </ul>
          <p>
            On each application, actions are stage-specific. After Stage 2 approval, use{" "}
            <strong>Shortlist for Interview</strong> to place the applicant in the unscheduled queue.
            Schedule dates in bulk from <strong>Interviews</strong>. Use <strong>Keep Pending</strong> to
            defer without shortlisting, or <strong>Reject Application</strong> for a final no.
          </p>
          <p>
            <strong className="text-gray-900">Typical path:</strong> Approve Stage 1 → applicant submits
            Stage 2 → Approve Stage 2 → Shortlist for Interview → batch-schedule on Interviews → mark
            interview complete → Accept into Programme or Reject.
          </p>
          <p>
            <strong className="text-gray-900">Interviews page</strong> — primary place to select multiple
            shortlisted candidates and assign one date/time/venue. Scheduling emails send only after batch
            assignment, not at shortlist.
          </p>
        </div>
      )}
    </div>
  );
}
