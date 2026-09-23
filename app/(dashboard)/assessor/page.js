"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { filterAssessorApplicationsBySearch } from "@/lib/assessor-applicant-search";

function nameFor(app) {
  return (
    app.application?.applicant?.full_name ||
    app.application?.full_name ||
    app.full_name ||
    app.profiles?.full_name ||
    app.profiles?.email ||
    "Applicant"
  );
}

export default function AssessorDashboardPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setDebug(null);
    try {
      const res = await fetch("/api/assessor/applications");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Applications could not be loaded. Please retry.");
        if (data.debug) setDebug(data.debug);
        setApplications([]);
      } else {
        setApplications(data.applications || []);
      }
    } catch {
      setError("Applications could not be loaded. Please retry.");
      setApplications([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredApplications = useMemo(
    () => filterAssessorApplicationsBySearch(applications, searchQuery),
    [applications, searchQuery]
  );

  const hasSearch = searchQuery.trim().length > 0;
  const clearSearch = () => setSearchQuery("");

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assigned Applicants</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review assigned applicants, score their submissions, and recommend the next stage.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>{error}</p>
              {debug && process.env.NODE_ENV === "development" ? (
                <p className="mt-2 break-all text-xs opacity-80">
                  {[debug.code, debug.message, debug.hint].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={load}
                className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {!error && applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No applications have been assigned to you yet.</p>
        </div>
      ) : null}

      {!error && applications.length > 0 ? (
        <>
          <div className="mb-4">
            <label htmlFor="assessor-applicant-search" className="sr-only">
              Search assigned applicants by name, email or institution
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                id="assessor-applicant-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search applicants by name, email or institution..."
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
                ? `Showing ${filteredApplications.length} of ${applications.length} assigned applicants`
                : `${applications.length} assigned applicant${applications.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {filteredApplications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <Search size={32} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                No assigned applicants match your search.
              </p>
              <button
                type="button"
                onClick={clearSearch}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApplications.map((app) => {
                const status = app.application?.status || app.status;
                const assignedAt = app.assignment?.assigned_at || app.assigned_at;
                const assessmentStatus =
                  app.assessment?.status || (app.has_assessment ? "submitted" : "pending");
                return (
                  <Link
                    key={app.id || app.application?.id}
                    href={`/assessor/${app.id || app.application?.id}`}
                    className="group flex min-w-0 flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                      {nameFor(app)
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate font-semibold text-gray-900">{nameFor(app)}</p>
                      <p className="truncate text-xs text-gray-500">
                        Assigned to you
                        {assignedAt ? ` · ${new Date(assignedAt).toLocaleString()}` : ""}
                        {" · "}
                        {app.application?.university || app.university || "No university"}
                      </p>
                    </div>
                    <div className="hidden flex-col items-end gap-1 sm:flex">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-amber-700">
                        {(status || "review").replace(/_/g, " ")}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          assessmentStatus === "submitted" ? "text-green-700" : "text-gray-500"
                        }`}
                      >
                        {assessmentStatus === "submitted" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                        {assessmentStatus === "submitted"
                          ? "Assessment submitted"
                          : "Assessment pending"}
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-royal" />
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
