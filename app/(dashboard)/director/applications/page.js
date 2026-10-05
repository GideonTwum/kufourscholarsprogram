import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isDirectorRole } from "@/lib/roles";
import { Filter } from "lucide-react";
import DirectorWorkflowGuide from "../components/DirectorWorkflowGuide";
import DirectorApplicationsList from "@/components/director/DirectorApplicationsList";
import DirectorAssessorFilter from "@/components/director/DirectorAssessorFilter";
import DirectorAssessorSummary from "@/components/director/DirectorAssessorSummary";
import {
  DIRECTOR_PENDING_STATUSES,
  DIRECTOR_PRIMARY_FILTERS,
  DIRECTOR_APPLICATION_STAGE_FILTERS,
  applyDirectorOperationalScope,
  applyDirectorStatusFilter,
  fetchAllApplicationPages,
  fetchDirectorApplicationCountSummary,
  filterByDirectorApplicationStage,
  normalizeDirectorApplicationStageParam,
  summarizeDirectorApplicationStageCounts,
} from "@/lib/director-application-scope";
import {
  DIRECTOR_WORKFLOW_FILTERS,
  classifyDirectorApplications,
  filterByDirectorAssessor,
  filterByDirectorWorkflow,
  normalizeDirectorAssessorParam,
  summarizeDirectorAssessorOptions,
  summarizeDirectorWorkflowCounts,
  summarizeSelectedAssessorWorkload,
} from "@/lib/director-application-workflow";
import { loadDirectorAssignmentWorkflowMeta } from "@/lib/director-assignment-workflow-meta";

function hrefForFilters({ status = "", workflow = "all", stage = "all", assessor = "" }) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (workflow && workflow !== "all") params.set("workflow", workflow);
  if (stage && stage !== "all") params.set("stage", stage);
  if (assessor) params.set("assessor", assessor);
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
 * Uses chunked assessment loading — a single giant `.in(application_id, …)` fails at scale.
 */
async function loadAssignmentWorkflowMeta(applications) {
  try {
    const admin = createAdminClient();
    return await loadDirectorAssignmentWorkflowMeta(admin, applications, {
      logLabel: "director-applications",
    });
  } catch (err) {
    console.error("[director-applications] loadAssignmentWorkflowMeta failed", {
      message: err?.message || String(err),
    });
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
  const stageFilter = normalizeDirectorApplicationStageParam(params?.stage);
  const assessorFilter = normalizeDirectorAssessorParam(params?.assessor);

  // Load full operational set for accurate stage/workflow/assessor counts, then filter in memory.
  const [{ applications: allOperational, loadError }, statusCounts] = await Promise.all([
    loadApplications(""),
    loadCounts(),
  ]);

  const assignmentMap = await loadAssignmentWorkflowMeta(allOperational);
  const classifiedAll = classifyDirectorApplications(allOperational, assignmentMap);
  const workflowCounts = summarizeDirectorWorkflowCounts(classifiedAll);
  const stageCounts = summarizeDirectorApplicationStageCounts(classifiedAll);
  const assessorOptions = summarizeDirectorAssessorOptions(classifiedAll);
  const assessorSummary = assessorFilter
    ? summarizeSelectedAssessorWorkload(classifiedAll, assessorFilter)
    : null;

  // Composition: operational → Status → Application Stage → Workflow → Assessor → (client search)
  const statusScoped = statusFilter
    ? classifiedAll.filter(({ app }) => {
        if (statusFilter === "pending") {
          return DIRECTOR_PENDING_STATUSES.includes(app.status);
        }
        return app.status === statusFilter;
      })
    : classifiedAll;

  const stageScoped = filterByDirectorApplicationStage(statusScoped, stageFilter);
  const workflowScoped = filterByDirectorWorkflow(stageScoped, workflowFilter);
  const listItems = filterByDirectorAssessor(workflowScoped, assessorFilter);

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

  const countForStage = (key) => {
    if (key === "all") return stageCounts.all;
    return stageCounts[key] || 0;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review submitted applications (drafts in progress are not listed here).
        </p>
        <p className="mt-2 text-xs text-gray-500">
          <span className="font-medium text-gray-600">Application Stage</span> is where the
          applicant is in recruitment.{" "}
          <span className="font-medium text-gray-600">Assessment Workflow</span> is where the
          application is in assessor processing.{" "}
          <span className="font-medium text-gray-600">Assessor</span> shows applications with a
          current active assignment to that person. These filters combine.
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

      {/* Application Stage — recruitment location from applications.status */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Application Stage:</span>
        </div>
        {DIRECTOR_APPLICATION_STAGE_FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            href={hrefForFilters({
              status: statusFilter,
              workflow: workflowFilter,
              stage: key,
              assessor: assessorFilter,
            })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              stageFilter === key
                ? "bg-royal text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label} ({countForStage(key)})
          </Link>
        ))}
      </div>

      {/* Assessment Workflow queues — mutually exclusive current processing stages */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Assessment Workflow:</span>
        </div>
        {DIRECTOR_WORKFLOW_FILTERS.map(({ key, label }) => (
          <Link
            key={key}
            href={hrefForFilters({
              status: statusFilter,
              workflow: key,
              stage: stageFilter,
              assessor: assessorFilter,
            })}
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
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Status:</span>
        </div>
        {DIRECTOR_PRIMARY_FILTERS.map(({ key, label }) => (
          <Link
            key={key || "all-status"}
            href={hrefForFilters({
              status: key,
              workflow: workflowFilter,
              stage: stageFilter,
              assessor: assessorFilter,
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

      <DirectorAssessorFilter
        options={assessorOptions}
        selectedId={assessorFilter}
        statusFilter={statusFilter}
        workflowFilter={workflowFilter}
        stageFilter={stageFilter}
      />

      {assessorSummary ? <DirectorAssessorSummary summary={assessorSummary} /> : null}

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
        stageFilter={stageFilter}
        assessorFilter={assessorFilter}
      />
    </div>
  );
}
