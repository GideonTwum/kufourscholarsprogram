"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight, FileText, Loader2 } from "lucide-react";

function nameFor(app) {
  return app.full_name || app.profiles?.full_name || app.profiles?.email || "Applicant";
}

export default function AssessorDashboardPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/assessor/applications");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load assigned applicants.");
      } else {
        setApplications(data.applications || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assigned Applicants</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review assigned applicants, score their submissions, and recommend the next stage.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!error && applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No assigned applicants yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Link
              key={app.id}
              href={`/assessor/${app.id}`}
              className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                {nameFor(app)
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate font-semibold text-gray-900">{nameFor(app)}</p>
                <p className="truncate text-xs text-gray-500">
                  {app.profiles?.email || "No email"} · {app.university || "No university"}
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                <CheckCircle2 size={12} />
                {app.status?.replace(/_/g, " ") || "review"}
              </span>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-royal" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
