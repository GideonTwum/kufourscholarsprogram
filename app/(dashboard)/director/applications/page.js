import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isDirectorRole } from "@/lib/roles";
import {
  FileText,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Video,
  Search,
} from "lucide-react";
import DirectorWorkflowGuide from "../components/DirectorWorkflowGuide";

/** In-progress statuses (not accepted / rejected / draft). */
const PENDING_STATUSES = [
  "stage_1_submitted",
  "pending",
  "review_pending",
  "stage_1_approved",
  "stage_2_submitted",
  "stage_2_review_pending",
  "stage_2_approved",
  "interview_review_pending",
  "called_for_interview",
  "interview",
];

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

const primaryFilters = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

function applyStatusFilter(query, statusFilter) {
  if (statusFilter === "pending") {
    return query.in("status", PENDING_STATUSES);
  }
  if (statusFilter === "accepted" || statusFilter === "rejected") {
    return query.eq("status", statusFilter);
  }
  return query;
}

async function fetchWithAdmin(statusFilter) {
  const admin = createAdminClient();
  let query = admin
    .from("applications")
    .select("*, profiles!applications_user_id_fkey(full_name, email, class_name)")
    .neq("status", "draft")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  query = applyStatusFilter(query, statusFilter);

  const { data, error } = await query;
  if (!error) return { applications: data || [], loadError: null };

  let fallbackQuery = admin
    .from("applications")
    .select("*")
    .neq("status", "draft")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  fallbackQuery = applyStatusFilter(fallbackQuery, statusFilter);

  const { data: fallbackData, error: fallbackError } = await fallbackQuery;
  return {
    applications: fallbackData || [],
    loadError: fallbackError?.message || error.message,
  };
}

async function fetchWithSession(supabase, statusFilter) {
  let query = supabase
    .from("applications")
    .select("*")
    .neq("status", "draft")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  query = applyStatusFilter(query, statusFilter);

  const { data, error } = await query;
  return {
    applications: data || [],
    loadError: error?.message ?? null,
  };
}

async function loadApplications(statusFilter) {
  try {
    return await fetchWithAdmin(statusFilter);
  } catch {
    const supabase = await createClient();
    return fetchWithSession(supabase, statusFilter);
  }
}

async function loadCounts() {
  const empty = { all: 0, pending: 0, accepted: 0, rejected: 0 };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("applications")
      .select("status")
      .neq("status", "draft");

    if (error || !data) return empty;

    return {
      all: data.length,
      pending: data.filter((r) => PENDING_STATUSES.includes(r.status)).length,
      accepted: data.filter((r) => r.status === "accepted").length,
      rejected: data.filter((r) => r.status === "rejected").length,
    };
  } catch {
    const supabase = await createClient();
    const { data } = await supabase
      .from("applications")
      .select("status")
      .neq("status", "draft");

    if (!data) return empty;

    return {
      all: data.length,
      pending: data.filter((r) => PENDING_STATUSES.includes(r.status)).length,
      accepted: data.filter((r) => r.status === "accepted").length,
      rejected: data.filter((r) => r.status === "rejected").length,
    };
  }
}

async function loadActiveAssignmentLabels() {
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("assessor_assignments")
      .select("application_id, assessor_id, status, profiles:assessor_id(full_name, email)")
      .eq("status", "active");

    const map = {};
    for (const row of rows || []) {
      const name = row.profiles?.full_name || row.profiles?.email || "Assessor";
      map[row.application_id] = {
        assessor_id: row.assessor_id,
        label: `Assigned to ${name}`,
        email: row.profiles?.email || null,
      };
    }

    const appIds = Object.keys(map);
    if (appIds.length === 0) return map;

    const { data: assessments } = await admin
      .from("application_assessments")
      .select("application_id, assessor_id, recommendation, submitted_at, assessor_name_snapshot")
      .in("application_id", appIds)
      .order("submitted_at", { ascending: false });

    const seen = new Set();
    for (const a of assessments || []) {
      if (seen.has(a.application_id)) continue;
      if (map[a.application_id]?.assessor_id && a.assessor_id !== map[a.application_id].assessor_id) {
        continue;
      }
      seen.add(a.application_id);
      if (map[a.application_id]) {
        const who = a.assessor_name_snapshot || map[a.application_id].label.replace(/^Assigned to /, "");
        map[a.application_id].label = `Assessment submitted by ${who}`;
        map[a.application_id].recommendation = a.recommendation || null;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export default async function DirectorApplicationsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/director-login");

  const { data: directorProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isDirectorRole(directorProfile?.role)) redirect("/director-login");

  const params = await searchParams;
  const statusFilter = params?.status || "";

  const [{ applications, loadError }, counts, assignmentLabels] = await Promise.all([
    loadApplications(statusFilter),
    loadCounts(),
    loadActiveAssignmentLabels(),
  ]);

  const countForFilter = (key) => {
    if (key === "") return counts.all;
    if (key === "pending") return counts.pending;
    if (key === "accepted") return counts.accepted;
    if (key === "rejected") return counts.rejected;
    return 0;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage applicant submissions.
        </p>
      </div>

      <DirectorWorkflowGuide compact />

      {loadError && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load all application details. If the list is empty, run{" "}
          <code className="text-xs">supabase-migration-hotfix-profiles-rls-final.sql</code> in
          Supabase and ensure <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> is set.
        </div>
      )}

      {/* Primary filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filter:</span>
        </div>
        {primaryFilters.map(({ key, label }) => (
          <Link
            key={key || "all"}
            href={key ? `/director/applications?status=${key}` : "/director/applications"}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-royal text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label} ({countForFilter(key)})
          </Link>
        ))}
      </div>

      {/* Application list */}
      {!applications || applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">
            {statusFilter === "pending"
              ? "No pending applications."
              : statusFilter === "accepted"
                ? "No accepted applications yet."
                : statusFilter === "rejected"
                  ? "No rejected applications."
                  : "No applications found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const config = statusConfig[app.status] || statusConfig.pending;
            const assignee = assignmentLabels[app.id];
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
                    {" · "}
                    <span className={assignee ? "text-indigo-700" : "text-gray-400"}>
                      {assignee?.label || "Unassigned"}
                    </span>
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.color}`}
                >
                  {statusConfig[app.status]?.label || config.label}
                </span>
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
