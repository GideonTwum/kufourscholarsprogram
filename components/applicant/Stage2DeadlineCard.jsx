"use client";

import DeadlineCountdown from "@/components/DeadlineCountdown";
import {
  evaluateStage2DeadlineGate,
  stage2DeadlineAbsoluteCopy,
  stage2DeadlineClosedCopy,
} from "@/lib/stage-2-deadline-gate";

/**
 * Stage 2 deadline card for eligible applicants (stage_1_approved).
 * @param {{ deadlineIso: string|null }} props
 */
export default function Stage2DeadlineCard({ deadlineIso }) {
  if (!deadlineIso) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Stage 2 deadline information is temporarily unavailable. Please try again later.
      </div>
    );
  }

  const gate = evaluateStage2DeadlineGate({ deadlineRaw: deadlineIso, nowMs: Date.now() });
  const absoluteOpen = stage2DeadlineAbsoluteCopy(deadlineIso);
  const absoluteClosed = stage2DeadlineClosedCopy(deadlineIso);

  if (!gate.isConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Stage 2 deadline information is temporarily unavailable. Please try again later.
      </div>
    );
  }

  if (gate.isExpired) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="text-sm font-bold text-amber-950">Stage 2 Deadline</h3>
        <p className="mt-2 text-sm font-semibold text-amber-900">Stage 2 submissions are closed.</p>
        <p className="mt-1 text-sm text-amber-800">{absoluteClosed}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-royal/15 bg-royal/5 p-5">
      <h3 className="text-sm font-bold text-royal">Stage 2 Deadline</h3>
      <div className="mt-3">
        <DeadlineCountdown
          deadline={deadlineIso}
          openLabel="Stage 2 closes in"
          closedLabel="Stage 2 submissions are closed."
          variant="card"
        />
      </div>
      {absoluteOpen ? <p className="mt-3 text-sm text-gray-700">{absoluteOpen}</p> : null}
    </div>
  );
}
