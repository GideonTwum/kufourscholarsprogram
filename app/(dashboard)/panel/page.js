"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FileText, ChevronRight, Video, CheckCircle2, Loader2 } from "lucide-react";

export default function PanelDashboardPage() {
  const supabase = createClient();
  const [applications, setApplications] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: apps } = await supabase
        .from("applications")
        .select("*, profiles!inner(full_name, email)")
        .eq("status", "interview")
        .order("submitted_at", { ascending: false });

      setApplications(apps || []);

      const { data: evals } = await supabase
        .from("interview_evaluations")
        .select("application_id, total_weighted_score")
        .eq("evaluator_id", user.id);

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

      {!applications || applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Video size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No applicants currently scheduled for interview.</p>
          <p className="mt-1 text-xs text-gray-400">Check back later when the Director assigns applicants to interview slots.</p>
        </div>
      ) : (
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
                  {app.profiles?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?"}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-semibold text-gray-900">
                    {app.profiles?.full_name || app.full_name || "Unknown"}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {app.profiles?.email}
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
      )}
    </div>
  );
}
