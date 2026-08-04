"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, Megaphone, MessageSquare, CalendarDays, UserCheck, Loader2, AlertCircle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const quickActions = [
  {
    title: "Manage Scholars",
    description: "Manage scholar profiles and cohorts",
    icon: Users,
    href: "/director/scholars",
  },
  {
    title: "Review Applications",
    description: "Review and process applicant submissions",
    icon: FileText,
    href: "/director/applications",
  },
  {
    title: "Schedule Interviews",
    description: "Create interview batches and notify applicants",
    icon: CalendarDays,
    href: "/director/interviews",
  },
  {
    title: "Post Announcement",
    description: "Send updates and announcements",
    icon: Megaphone,
    href: "/director/announcements",
  },
  {
    title: "Messages",
    description: "Communicate directly with applicants",
    icon: MessageSquare,
    href: "/director/messages",
  },
  {
    title: "Manage Assessors",
    description: "Invite assessors and assign applicants for review",
    icon: UserCheck,
    href: "/director/assessors",
  },
];

function MetricCard({ label, value, href, tone = "default" }) {
  const tones = {
    default: "bg-white text-gray-900",
    amber: "bg-amber-50 text-amber-900",
    green: "bg-green-50 text-green-900",
    red: "bg-red-50 text-red-900",
    indigo: "bg-indigo-50 text-indigo-900",
  };
  const inner = (
    <div className={`rounded-xl border border-gray-100 p-5 shadow-sm ${tones[tone] || tones.default}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value ?? "—"}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition hover:-translate-y-0.5">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default function DirectorDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/director/dashboard-metrics");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load dashboard metrics");
        setMetrics(null);
      } else {
        setMetrics(data);
      }
    } catch {
      setError("Failed to load dashboard metrics");
      setMetrics(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const t = metrics?.totals;
  const staff = metrics?.staff;
  const settings = metrics?.settings;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Director Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back. Live Cohort operations overview for the Kufuor Scholars Program.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading && !metrics ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-royal" />
        </div>
      ) : metrics ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total applications" value={t.total_applications} href="/director/applications" />
            <MetricCard
              label="Stage 1 pending"
              value={t.stage_1_pending}
              href="/director/applications?status=stage_1_submitted"
              tone="amber"
            />
            <MetricCard
              label="Stage 2 pending"
              value={t.stage_2_pending}
              href="/director/applications?status=stage_2_submitted"
              tone="indigo"
            />
            <MetricCard label="Interviews" value={t.interviews} href="/director/interviews" tone="indigo" />
            <MetricCard label="Accepted" value={t.accepted} href="/director/applications?status=accepted" tone="green" />
            <MetricCard label="Rejected" value={t.rejected} href="/director/applications?status=rejected" tone="red" />
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Active assessors" value={staff.active_assessors} href="/director/assessors" />
            <MetricCard label="Active panel" value={staff.active_panel} href="/director/panel" />
            <MetricCard label="Active assignments" value={staff.active_assignments} href="/director/assessors" />
            <MetricCard label="Panel evaluations" value={staff.panel_evaluations} href="/director/interviews" />
          </div>

          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900">Application status</h2>
              <p className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                {settings.applications_open ? (
                  <CheckCircle2 size={16} className="text-green-600" />
                ) : (
                  <XCircle size={16} className="text-gray-400" />
                )}
                Applications {settings.applications_open ? "open" : "closed"}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Deadline:{" "}
                {settings.application_deadline
                  ? new Date(settings.application_deadline).toLocaleString()
                  : "Not set"}
              </p>
              <Link href="/director/settings" className="mt-4 inline-block text-sm font-medium text-royal hover:underline">
                Manage settings
              </Link>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Recent activity</h2>
                <Link href="/director/audit-log" className="text-xs font-medium text-royal hover:underline">
                  Full audit log
                </Link>
              </div>
              {(metrics.recent_activity || []).length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No audit events yet.</p>
              ) : (
                <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {metrics.recent_activity.map((ev) => (
                    <li key={ev.id} className="border-b border-gray-50 pb-2 text-xs text-gray-600">
                      <span className="font-medium text-gray-900">{ev.action}</span>
                      {" · "}
                      {ev.actor_name_snapshot || ev.actor_email_snapshot || "Director"}
                      <span className="block text-gray-400">
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}

      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Quick actions</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => (
          <a
            key={action.title}
            href={action.href}
            className="group flex flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-royal/5 text-royal transition-colors group-hover:bg-gold/10 group-hover:text-gold">
              <action.icon size={20} />
            </div>
            <h3 className="mt-4 font-semibold text-gray-900 group-hover:text-royal">{action.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{action.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
