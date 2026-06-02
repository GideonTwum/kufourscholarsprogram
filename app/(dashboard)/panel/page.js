"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  FileText,
  ChevronRight,
  Video,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  getApplicantDisplayName,
  getApplicantDisplayEmail,
  getApplicantInitials,
} from "@/lib/panel-applications";

export default function PanelDashboardPage() {
  const supabase = createClient();
  const [applications, setApplications] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoadError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadError("You must be signed in as a panel member.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/panel/applications");
      const json = await res.json();

      if (!res.ok) {
        setLoadError(json.error || "Failed to load interview applicants.");
        setApplications([]);
        setLoading(false);
        return;
      }

      setApplications(json.applications || []);

      const { data: evals, error: evalError } = await supabase
        .from("interview_evaluations")
        .select("application_id, total_weighted_score")
        .eq("evaluator_id", user.id);

      if (evalError) {
        console.error("[panel] evaluations load failed:", evalError.message);
      }

      const evalMap = {};
      (evals || []).forEach((e) => {
        evalMap[e.application_id] = e.total_weighted_score;
      });
      setEvaluations(evalMap);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Interview Applicants</h1>
        <p className="mt-1 text-sm text-gray-500">
          View applicants scheduled for interview and submit your scores.
        </p>
      </div>

      {loadError && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Could not load applicants</p>
            <p className="mt-1">{loadError}</p>
            <p className="mt-2 text-xs text-red-700">
              If this persists, ask an administrator to run{" "}
              <code className="rounded bg-red-100 px-1">
                supabase-migration-hotfix-panel-dashboard-join.sql
              </code>{" "}
              and confirm <code className="rounded bg-red-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              is set.
            </p>
          </div>
        </div>
      )}

      {!loadError && (!applications || applications.length === 0) ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Video size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No applicants currently scheduled for interview.</p>
          <p className="mt-1 text-xs text-gray-400">
            Check back later when the Director assigns applicants to interview slots.
          </p>
        </div>
      ) : !loadError ? (
        <div className="space-y-3">
          {applications.map((app) => {
            const hasScored = evaluations[app.id] != null;
            return (
              <Link
                key={app.id}
                href={`/panel/${app.id}`}
                className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                  {getApplicantInitials(app)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-semibold text-gray-900">
                    {getApplicantDisplayName(app)}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {getApplicantDisplayEmail(app)}
                  </p>
                </div>
                {hasScored ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                    <CheckCircle2 size={12} />
                    Scored: {evaluations[app.id]}%
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Pending
                  </span>
                )}
                <ChevronRight
                  size={16}
                  className="text-gray-300 transition-colors group-hover:text-royal"
                />
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
