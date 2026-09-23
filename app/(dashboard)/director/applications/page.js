import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isDirectorRole } from "@/lib/roles";
import { Filter } from "lucide-react";
import DirectorWorkflowGuide from "../components/DirectorWorkflowGuide";
import DirectorApplicationsList from "@/components/director/DirectorApplicationsList";
import {
  DIRECTOR_PENDING_STATUSES,
  DIRECTOR_PRIMARY_FILTERS,
  applyDirectorOperationalScope,
  applyDirectorStatusFilter,
  fetchAllApplicationPages,
  fetchDirectorApplicationCountSummary,
} from "@/lib/director-application-scope";
import {
  DIRECTOR_WORKFLOW_FILTERS,
  buildDirectorAssignmentWorkflowMap,
  classifyDirectorApplications,
  filterByDirectorWorkflow,
  summarizeDirectorWorkflowCounts,
} from "@/lib/director-application-workflow";

function hrefForFilters({ status = "", workflow = "all" }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (workflow && workflow !== "all") params.set("workflow", workflow);
  const qs = params.toString();
  return qs ? `/director/applications?${qs}` : "/director/applications";
}

async function fetchWithAdmin(statusFilter) {
  const admin = createAdminClient();
  const build = () => {
    let query = admin
      .from("applications")
      .select("*, profiles!applications_user_id_fkey(full_name, email, class_name)")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    query = applyDirectorOperationalScope(query);
    query = applyDirectorStatusFilter(query, statusFilter);
    return query;
  };

  const { data, error } = await fetchAllApplicationPages(build);
  if (!error) return { applications: data || [], loadError: null };

  const buildFallback = () => {
    let fallbackQuery = admin
      .from("applications")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    fallbackQuery = applyDirectorOperationalScope(fallbackQuery);
    fallbackQuery = applyDirectorStatusFilter(fallbackQuery, statusFilter);
    return fallbackQuery;
  };

  const { data: fallbackData, error: fallbackError } = await fetchAllApplicationPages(buildFallback);
  return {
    applications: fallbackData || [],
    loadError: fallbackError?.message || error.message,
  };
}

async function fetchWithSession(supabase, statusFilter) {
  const build = () => {
    let query = supabase
      .from("applications")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    query = applyDirectorOperationalScope(query);
    query = applyDirectorStatusFilter(query, statusFilter);
    return query;
  };

  const { data, error } = await fetchAllApplicationPages(build);
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
  const empty = { all: 0, pending: 0, accepted: 0, rejected: 0, draft: 0 };
  try {
    const admin = createAdminClient();
    const { summary } = await fetchDirectorApplicationCountSummary(admin);
    return {
      all: summary.all,
      pending: summary.pending,
      accepted: summary.accepted,
      rejected: summary.rejected,
      draft: summary.draft,
    };
  } catch {
    try {
      const supabase = await createClient();
      const { summary } = await fetchDirectorApplicationCountSummary(supabase);
      return {
        all: summary.all,
        pending: summary.pending,
        accepted: summary.accepted,
        rejected: summary.rejected,
        draft: summary.draft,
      };
    } catch {
      return empty;
    }
  }
}

/**
 * Active assignments + matching assessments for workflow classification and labels.
 * Operates on the full Director operational population (not the visible page alone).
 */
async function loadAssignmentWorkflowMeta(applications) {
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("assessor_assignments")
      .select("application_id, assessor_id, status, profiles:assessor_id(full_name, email)")
      .eq("status", "active");

    const active = rows || [];
    const appIds = active.map((r) => r.application_id).filter(Boolean);
    let assessments = [];
    if (appIds.length > 0) {
      const { data: assessmentRows } = await admin
        .from("application_assessments")
        .select(
          "application_id, assessor_id, stage, recommendation, submitted_at, assessor_name_snapshot"
        )
        .in("application_id", appIds)
        .order("submitted_at", { ascending: false });
      assessments = assessmentRows || [];
    }

    const statusByAppId = Object.fromEntries(
      (applications || []).map((app) => [app.id, app.status])
    );
    return buildDirectorAssignmentWorkflowMap(active, assessments, statusByAppId);
  } catch {
    return {};
  }
}

function normalizeWorkflowParam(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key || key === "all") return "all";
  if (DIRECTOR_WORKFLOW_FILTERS.some((f) => f.key === key)) return key;
  return "all";
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
  const workflowFilter = normalizeWorkflowParam(params?.workflow);

  // Load full operational set for accurate workflow counts, then apply status filter in memory.
  const [{ applications: allOperational, loadError }, statusCounts] = await Promise.all([
    loadApplications(""),
    loadCounts(),
  ]);

  const assignmentMap = await loadAssignmentWorkflowMeta(allOperational);
  const classifiedAll = classifyDirectorApplications(allOperational, assignmentMap);
  const workflowCounts = summarizeDirectorWorkflowCounts(classifiedAll);

  // Status filter (Pending / Accepted / Rejected / exact) on top of operational set
  const statusScoped = statusFilter
    ? classifiedAll.filter(({ app }) => {
        if (statusFilter === "pending") {
          return DIRECTOR_PENDING_STATUSES.includes(app.status);
        }
        return app.status === statusFilter;
      })
    : classifiedAll;

  const listItems = filterByDirectorWorkflow(statusScoped, workflowFilter);

  const countForStatusFilter = (key) => {
    if (key === "") return statusCounts.all;
    if (key === "pending") return statusCounts.pending;
    if (key === "accepted") return statusCounts.accepted;
    if (key === "rejected") return statusCounts.rejected;
    return 0;
  };

  const countForWorkflow = (key) => {
    if (key === "all") return workflowCounts.all;
    return workflowCounts[key] || 0;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review submitted applications (drafts in progress are not listed here).
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

      {/* Workflow queues — mutually exclusive current stages */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Workflow:</span>
        </div>
        {DIRECTOR_WORKFLOW_FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            href={hrefForFilters({ status: statusFilter, workflow: key })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              workflowFilter === key
                ? "bg-royal text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label} ({countForWorkflow(key)})
          </Link>
        ))}
      </div>

      {/* Existing outcome / pipeline status chips */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Status:</span>
        </div>
        {DIRECTOR_PRIMARY_FILTERS.map(({ key, label }) => (
          <Link
            key={key || "all-status"}
            href={hrefForFilters({
              status: key,
              workflow: workflowFilter,
            })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === key
                ? "bg-royal text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {key === "" ? "All statuses" : label} ({countForStatusFilter(key)})
          </Link>
        ))}
      </div>

      {statusCounts.draft > 0 ? (
        <p className="mb-4 text-xs text-gray-500">
          {statusCounts.draft} draft application{statusCounts.draft === 1 ? "" : "s"} in progress
          (not shown until Stage 1 is submitted).
        </p>
      ) : null}

      <DirectorApplicationsList
        items={listItems}
        workflowFilter={workflowFilter}
        statusFilter={statusFilter}
      />
    </div>
  );
}
