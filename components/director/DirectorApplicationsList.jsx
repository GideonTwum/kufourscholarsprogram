"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Search,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import {
  DIRECTOR_WORKFLOW_LABELS,
  directorApplicationMatchesSearch,
  isDirectorTerminalStatus,
} from "@/lib/director-application-workflow";

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-amber-50 text-amber-700",
    icon: Clock,
  },
  stage_1_submitted: {
    label: "Stage 1 review",
    color: "bg-amber-50 text-amber-700",
    icon: Search,
  },
  review_pending: {
    label: "Deferred",
    color: "bg-slate-100 text-slate-700",
    icon: Clock,
  },
  stage_1_approved: {
    label: "Stage 1 ✓",
    color: "bg-purple-50 text-purple-700",
    icon: Users,
  },
  stage_2_submitted: {
    label: "Stage 2 review",
    color: "bg-indigo-50 text-indigo-700",
    icon: Video,
  },
  stage_2_review_pending: {
    label: "Stage 2 deferred",
    color: "bg-slate-100 text-slate-700",
    icon: Clock,
  },
  stage_2_approved: {
    label: "Stage 2 ✓",
    color: "bg-indigo-50 text-indigo-700",
    icon: Video,
  },
  interview_review_pending: {
    label: "Interview pending",
    color: "bg-slate-100 text-slate-700",
    icon: Clock,
  },
  called_for_interview: {
    label: "Interview",
    color: "bg-indigo-50 text-indigo-700",
    icon: Video,
  },
  interview: {
    label: "Interview",
    color: "bg-indigo-50 text-indigo-700",
    icon: Video,
  },
  accepted: {
    label: "Accepted",
    color: "bg-green-50 text-green-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-50 text-red-700",
    icon: XCircle,
  },
  draft: {
    label: "Draft",
    color: "bg-gray-50 text-gray-500",
    icon: Clock,
  },
};

const workflowBadgeClass = {
  unassigned: "bg-gray-100 text-gray-600",
  assigned: "bg-indigo-50 text-indigo-700",
  assessed: "bg-emerald-50 text-emerald-700",
  interview_panel: "bg-violet-50 text-violet-700",
};

/**
 * Client list: search within the already server-scoped + workflow-filtered set.
 * Does not fetch applications — search never expands authorization.
 */
export default function DirectorApplicationsList({
  items = [],
  workflowFilter = "all",
  statusFilter = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const hasSearch = searchQuery.trim().length > 0;

  const filtered = useMemo(() => {
    if (!hasSearch) return items;
    return items.filter((row) => directorApplicationMatchesSearch(row.app, searchQuery));
  }, [items, searchQuery, hasSearch]);

  const clearSearch = () => setSearchQuery("");

  const emptyMessage = () => {
    if (hasSearch) return "No applications match your search in this workflow view.";
    if (workflowFilter === "unassigned") return "No unassigned applications.";
    if (workflowFilter === "assigned") return "No applications awaiting assessor review.";
    if (workflowFilter === "assessed") return "No assessed applications awaiting Director action.";
    if (workflowFilter === "interview_panel") return "No interview / panel applications.";
    if (statusFilter === "pending") return "No pending applications.";
    if (statusFilter === "accepted") return "No accepted applications yet.";
    if (statusFilter === "rejected") return "No rejected applications.";
    return "No applications found.";
  };

  return (
    <div>
      {items.length > 0 ? (
        <div className="mb-4">
          <label htmlFor="director-application-search" className="sr-only">
            Search applications by name, email or institution
          </label>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="director-application-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email or institution..."
              autoComplete="off"
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-royal focus:ring-2 focus:ring-royal/20"
            />
            {hasSearch ? (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-royal/20"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-gray-500" aria-live="polite">
            {hasSearch
              ? `Showing ${filtered.length} of ${items.length} in this view`
              : `${items.length} application${items.length === 1 ? "" : "s"} in this view`}
          </p>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">{emptyMessage()}</p>
          {hasSearch ? (
            <button
              type="button"
              onClick={clearSearch}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear search
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ app, workflow, assignment, workflowLabel }) => {
            const config = statusConfig[app.status] || statusConfig.pending;
            return (
              <Link
                key={app.id}
                href={`/director/applications/${app.id}`}
                className="group flex min-w-0 flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                  {(app.profiles?.full_name || app.full_name)
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate font-semibold text-gray-900">
                    {app.profiles?.full_name || app.full_name || "Unknown"}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {app.profiles?.email || "\u2014"}
                    {assignment ? (
                      <>
                        {" · "}
                        <span className="text-indigo-700">{assignment.label}</span>
                      </>
                    ) : isDirectorTerminalStatus(app.status) ? null : (
                      <>
                        {" · "}
                        <span className="text-gray-400">Unassigned</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                  {workflow ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        workflowBadgeClass[workflow] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {workflowLabel || DIRECTOR_WORKFLOW_LABELS[workflow]}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.color}`}
                  >
                    {statusConfig[app.status]?.label || config.label}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {app.submitted_at
                    ? new Date(app.submitted_at).toLocaleDateString()
                    : "\u2014"}
                </span>
                <ChevronRight
                  size={16}
                  className="text-gray-300 transition-colors group-hover:text-royal"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
