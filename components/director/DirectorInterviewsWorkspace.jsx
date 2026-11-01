"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DirectorPublishedInterviews from "@/components/director/DirectorPublishedInterviews";
import DirectorInterviewRequestsPanel from "@/components/director/DirectorInterviewRequestsPanel";

const TABS = [
  { id: "batches", label: "Interview Batches" },
  { id: "published", label: "Published Invitations" },
  { id: "requests", label: "Applicant Responses" },
];

const LEGACY_TABS = {
  overview: "batches",
  allocation: "batches",
  schedule: "batches",
};

export default function DirectorInterviewsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "batches";
  const tab = TABS.some((item) => item.id === rawTab)
    ? rawTab
    : LEGACY_TABS[rawTab] || "batches";

  const initialFilters = useMemo(
    () => ({
      region: searchParams.get("region") || "",
      loc: searchParams.get("loc") || "",
      q: searchParams.get("q") || "",
    }),
    [searchParams]
  );

  function setTab(next) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/director/interviews?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a batch, assign shortlisted applicants, review the list, then publish to send
          invitations. Draft batches never email applicants.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === item.id
                ? "border-royal text-royal"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "batches" ? <DirectorPublishedInterviews mode="manage" initialFilters={initialFilters} /> : null}
      {tab === "published" ? <DirectorPublishedInterviews mode="published" /> : null}
      {tab === "requests" ? <DirectorInterviewRequestsPanel /> : null}
    </div>
  );
}
