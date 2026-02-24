import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageSquare,
  Filter,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const statusConfig = {
  open: { label: "Open", color: "bg-blue-50 text-blue-700" },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-700" },
  resolved: { label: "Resolved", color: "bg-green-50 text-green-700" },
  closed: { label: "Closed", color: "bg-gray-50 text-gray-500" },
};

const allStatuses = ["open", "in_progress", "resolved", "closed"];

export default async function DirectorRequestsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params?.status || "";

  let query = supabase
    .from("requests")
    .select("*, profiles!requests_user_id_fkey(full_name, email, class_name)")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: requests } = await query;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Scholar Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and respond to scholar requests.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filter:</span>
        </div>
        <Link
          href="/director/requests"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !statusFilter
              ? "bg-royal text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({requests?.length || 0})
        </Link>
        {allStatuses.map((s) => (
          <Link
            key={s}
            href={`/director/requests?status=${s}`}
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

      {!requests || requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <MessageSquare size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No requests found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const config = statusConfig[req.status] || statusConfig.open;
            return (
              <Link
                key={req.id}
                href={`/director/requests/${req.id}`}
                className="group flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                  {req.profiles?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?"}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-semibold text-gray-900">
                    {req.subject}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {req.profiles?.full_name} &middot;{" "}
                    {req.profiles?.class_name || "No class"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.color}`}
                >
                  {config.label}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(req.created_at).toLocaleDateString()}
                </span>
                <ChevronRight
                  size={16}
                  className="text-gray-300 group-hover:text-royal"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
