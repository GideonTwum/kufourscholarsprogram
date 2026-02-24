import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
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

const statusConfig = {
  submitted: {
    label: "Submitted",
    color: "bg-blue-50 text-blue-700",
    icon: FileText,
  },
  under_review: {
    label: "Under Review",
    color: "bg-amber-50 text-amber-700",
    icon: Search,
  },
  shortlisted: {
    label: "Shortlisted",
    color: "bg-purple-50 text-purple-700",
    icon: Users,
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

const allStatuses = [
  "submitted",
  "under_review",
  "shortlisted",
  "interview",
  "accepted",
  "rejected",
];

export default async function DirectorApplicationsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params?.status || "";

  let query = supabase
    .from("applications")
    .select("*, profiles!inner(full_name, email, class_name)")
    .neq("status", "draft")
    .order("submitted_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: applications } = await query;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage applicant submissions.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filter:</span>
        </div>
        <Link
          href="/director/applications"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !statusFilter
              ? "bg-royal text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({applications?.length || 0})
        </Link>
        {allStatuses.map((s) => (
          <Link
            key={s}
            href={`/director/applications?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-royal text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {statusConfig[s].label}
          </Link>
        ))}
      </div>

      {/* Application list */}
      {!applications || applications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No applications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const config = statusConfig[app.status] || statusConfig.draft;
            return (
              <Link
                key={app.id}
                href={`/director/applications/${app.id}`}
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
                    {app.profiles?.full_name || "Unknown"}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {app.profiles?.email}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.color}`}
                >
                  {config.label}
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
