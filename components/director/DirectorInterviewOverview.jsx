"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/read-response-json";

function Card({ label, value, href, tone = "default" }) {
  const tones = {
    default: "bg-white text-gray-900",
    amber: "bg-amber-50 text-amber-900",
    green: "bg-green-50 text-green-900",
    indigo: "bg-indigo-50 text-indigo-900",
  };
  const inner = (
    <div className={`rounded-xl border border-gray-100 p-4 shadow-sm ${tones[tone] || tones.default}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value ?? "—"}</p>
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

export default function DirectorInterviewOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { ok, data } = await fetchJson("/api/director/interview-allocations");
      if (cancelled) return;
      if (!ok) {
        setError(data.error || "Failed to load interview overview");
        setData(null);
      } else {
        setError(data.load_error || "");
        setData(data);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-royal" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error}
      </div>
    );
  }

  const c = data?.counts || {};
  const days = (data?.days || []).map((day) => {
    const bucket = (c.by_date || []).find((item) => item.day_id === day.id);
    return {
      ...day,
      count: bucket?.count ?? day.count ?? 0,
    };
  });

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          label="Eligible shortlisted"
          value={c.eligible}
          href="/director/interviews?tab=allocation"
        />
        <Card
          label="Physical allocated"
          value={c.physical}
          href="/director/interviews?tab=allocation&alloc=physical"
          tone="green"
        />
        <Card
          label="Pending remote"
          value={c.pending_remote}
          href="/director/interviews?tab=allocation&alloc=pending_remote"
          tone="amber"
        />
        <Card
          label="Unallocated"
          value={c.unallocated}
          href="/director/interviews?tab=allocation&alloc=unallocated"
        />
        <Card
          label="Study location not confirmed"
          value={c.unconfirmed_location}
          href="/director/interviews?tab=allocation&loc=unconfirmed"
          tone="amber"
        />
        <Card
          label="Assigned to batches"
          value={c.scheduled}
          href="/director/interviews?tab=allocation&alloc=physical"
          tone="green"
        />
        <Card
          label="Awaiting a time"
          value={c.unscheduled}
          href="/director/interviews?tab=allocation"
        />
        <Card
          label="Approved virtual"
          value={c.virtual_approved}
          href="/director/interviews?tab=allocation"
        />
        <Card
          label="Attendance confirmed"
          value={c.attendance_confirmed}
          href="/director/interviews?tab=allocation"
        />
        <Card
          label="Pending requests"
          value={c.pending_requests}
          href="/director/interviews?tab=allocation"
          tone="amber"
        />
      </div>

      <h2 className="mb-3 text-sm font-bold text-gray-900">Interview schedule</h2>
      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-sm text-gray-500">
          No interview dates configured. Add dates in Interview Schedule.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => (
            <Card
              key={day.day_id || day.id}
              label={day.label || day.interview_date}
              value={
                day.capacity
                  ? `${day.count ?? 0} / ${day.capacity}`
                  : day.count ?? 0
              }
              href={`/director/interviews?tab=allocation&idate=${encodeURIComponent(day.date || day.interview_date || "")}`}
              tone="indigo"
            />
          ))}
        </div>
      )}
    </div>
  );
}
