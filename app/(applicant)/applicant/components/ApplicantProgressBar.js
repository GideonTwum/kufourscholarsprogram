"use client";

import { CheckCircle2, Search, Users, Video } from "lucide-react";
import {
  APPLICANT_PROGRESS_STEPS,
  applicantProgressIndex,
  normalizeApplicationStatus,
} from "@/lib/application-status";

const stepIcons = {
  stage_1_submitted: Search,
  stage_1_approved: Users,
  stage_2_submitted: Video,
  stage_2_approved: Video,
  called_for_interview: Video,
};

export default function ApplicantProgressBar({ status, compact = false }) {
  const normalized = normalizeApplicationStatus(status);
  const currentIndex = applicantProgressIndex(status);

  if (normalized === "draft" || currentIndex < 0) return null;

  const size = compact ? "h-8 w-8" : "h-10 w-10";
  const iconSize = compact ? 14 : 18;

  return (
    <div className={`flex items-center justify-center ${compact ? "py-2" : "py-4"}`}>
      {APPLICANT_PROGRESS_STEPS.map((step, i) => {
        const completed = i < currentIndex;
        const active = i === currentIndex;
        const StepIcon = stepIcons[step.key] || Search;
        return (
          <div key={step.key} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex ${size} items-center justify-center rounded-full ${
                  completed
                    ? "bg-royal text-white"
                    : active
                      ? "bg-gold text-royal ring-4 ring-gold/20"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {completed ? <CheckCircle2 size={iconSize} /> : <StepIcon size={iconSize} />}
              </div>
              <span
                className={`mt-2 max-w-[72px] text-center text-[10px] font-medium sm:text-[11px] ${
                  active ? "text-royal" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < APPLICANT_PROGRESS_STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${completed ? "bg-royal" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
