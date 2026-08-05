"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Video,
  Calendar,
  MapPin,
  Users,
  Loader2,
  CheckCircle2,
  Plus,
  Send,
  Search,
} from "lucide-react";

function applicantLabel(app) {
  return app.applicant_name || app.full_name || app.profiles?.full_name || "Unknown";
}

function applicantEmail(app) {
  return app.email || app.profiles?.email || "—";
}

export default function DirectorInterviewsPage() {
  const [queueUnscheduled, setQueueUnscheduled] = useState([]);
  const [readyToShortlist, setReadyToShortlist] = useState([]);
  const [applications, setApplications] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("unscheduled");

  const [form, setForm] = useState({
    batch_name: "",
    interview_date: "",
    interview_time: "",
    location: "",
    congratulations_message: "",
    meeting_link: "",
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [allowUnshortlisted, setAllowUnshortlisted] = useState(false);

  async function loadData() {
    setError(null);
    const res = await fetch("/api/director/interview-slots");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load interview data");
      return false;
    }
    setApplications(data.applications || []);
    setSlots(data.slots || []);
    setQueueUnscheduled(data.queue?.unscheduled || []);
    setReadyToShortlist(data.queue?.ready_to_shortlist || []);
    return true;
  }

  useEffect(() => {
    async function load() {
      await loadData();
      setLoading(false);
    }
    load();
  }, []);

  const selectablePool = useMemo(() => {
    const base = allowUnshortlisted
      ? [...queueUnscheduled, ...readyToShortlist]
      : queueUnscheduled;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((app) => {
      const hay = `${applicantLabel(app)} ${applicantEmail(app)} ${app.university || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [queueUnscheduled, readyToShortlist, allowUnshortlisted, search]);

  const scheduledSlots = useMemo(
    () => (slots || []).filter((s) => (s.status || "scheduled") === "scheduled"),
    [slots]
  );
  const completedSlots = useMemo(
    () => (slots || []).filter((s) => s.status === "completed"),
    [slots]
  );

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(selectablePool.map((a) => a.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function createAndAssign(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (selectedIds.size === 0) {
      setError("Select at least one candidate from the unscheduled queue.");
      return;
    }
    setSaving(true);

    const res = await fetch("/api/interview-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        application_ids: Array.from(selectedIds),
        allow_unshortlisted: allowUnshortlisted,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create batch");
      setSaving(false);
      return;
    }

    setForm({
      batch_name: "",
      interview_date: "",
      interview_time: "",
      location: "",
      congratulations_message: "",
      meeting_link: "",
    });
    setSelectedIds(new Set());
    await loadData();
    setSuccess(
      `Batch created. ${data.notified || 0} applicant(s) scheduled and notified.${
        data.skipped?.length ? ` Skipped ${data.skipped.length}.` : ""
      }`
    );
    setSaving(false);
    setSection("scheduled");
  }

  async function cancelBatch(slotId) {
    if (!window.confirm("Cancel this interview batch? Candidates return to the unscheduled queue and are notified.")) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/director/interview-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to cancel batch");
      setSaving(false);
      return;
    }
    await loadData();
    setSuccess("Batch cancelled. Candidates returned to the interview queue.");
    setSaving(false);
  }

  async function completeBatch(slotId) {
    if (!window.confirm("Mark this batch complete? Assigned applicants will move to final programme review.")) {
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/director/interview-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to mark complete");
      setSaving(false);
      return;
    }
    await loadData();
    setSuccess(
      `Batch completed. ${data.applicants_advanced || 0} applicant(s) moved to final review.`
    );
    setSaving(false);
    setSection("completed");
  }

  async function deleteBatch(slotId) {
    if (!window.confirm("Delete this empty interview batch? This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/director/interview-slots/${slotId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to delete batch");
      setSaving(false);
      return;
    }
    await loadData();
    setSuccess("Empty batch deleted.");
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Interview Scheduling</h1>
        <p className="mt-1 text-sm text-gray-500">
          Shortlist applicants from application detail, then schedule them here in batches. Scheduling
          emails are sent only when a batch is assigned — not at shortlist.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {[
          { id: "unscheduled", label: `Unscheduled (${queueUnscheduled.length})` },
          { id: "schedule", label: "Schedule Selected" },
          { id: "scheduled", label: `Scheduled Batches (${scheduledSlots.length})` },
          { id: "completed", label: `Completed (${completedSlots.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              section === tab.id
                ? "border-royal text-royal"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(section === "unscheduled" || section === "schedule") && (
        <div className="mb-10 space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-gray-900">
                  <Users size={18} /> Unscheduled Interview Candidates
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Shortlisted applicants waiting for a batch date/time. {selectedIds.size} selected.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Select all visible
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear selection
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, university…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={allowUnshortlisted}
                  onChange={(e) => setAllowUnshortlisted(e.target.checked)}
                />
                Include Stage 2 approved not yet shortlisted (exceptional)
              </label>
            </div>

            {selectablePool.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                No unscheduled candidates. Shortlist applicants from application detail first.
                {readyToShortlist.length > 0
                  ? ` ${readyToShortlist.length} Stage 2 approved applicant(s) are waiting to be shortlisted.`
                  : ""}
              </p>
            ) : (
              <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
                {selectablePool.map((app) => (
                  <label
                    key={app.id}
                    className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                      className="mt-1"
                      aria-label={`Select ${applicantLabel(app)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-gray-900">{applicantLabel(app)}</p>
                        <Link
                          href={`/director/applications/${app.id}`}
                          className="text-xs font-medium text-royal hover:text-gold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open application
                        </Link>
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {applicantEmail(app)} · {app.university || "No university"}
                      </p>
                      <p className="mt-1 text-xs capitalize text-royal">
                        {(app.status || "").replace(/_/g, " ")}
                        {app.interview_shortlisted_at
                          ? ` · Shortlisted ${new Date(app.interview_shortlisted_at).toLocaleDateString()}`
                          : ""}
                      </p>
                      {app.latest_assessment ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Assessor:{" "}
                          {(app.latest_assessment.recommendation || "—").replace(/_/g, " ")}
                          {app.latest_assessment.overall_score != null
                            ? ` · Score ${Number(app.latest_assessment.overall_score).toFixed(2)}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <Plus size={18} /> Schedule Selected Candidates
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Creates one interview batch and assigns every selected candidate. Emails send after
              assignment.
            </p>
            <form onSubmit={createAndAssign} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Batch name</label>
                  <input
                    type="text"
                    value={form.batch_name}
                    onChange={(e) => setForm((f) => ({ ...f, batch_name: e.target.value }))}
                    placeholder="e.g. Batch A — Morning"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
                  <input
                    type="date"
                    value={form.interview_date}
                    onChange={(e) => setForm((f) => ({ ...f, interview_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                  <input
                    type="text"
                    value={form.interview_time}
                    onChange={(e) => setForm((f) => ({ ...f, interview_time: e.target.value }))}
                    placeholder="e.g. 9:00 AM"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Venue / location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. JAK Foundation, Accra"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Meeting link (optional)
                </label>
                <input
                  type="url"
                  value={form.meeting_link}
                  onChange={(e) => setForm((f) => ({ ...f, meeting_link: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Instructions / message to applicants
                </label>
                <textarea
                  value={form.congratulations_message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, congratulations_message: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              <button
                type="submit"
                disabled={saving || selectedIds.size === 0}
                className="flex items-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Schedule selected ({selectedIds.size})
              </button>
            </form>
          </div>
        </div>
      )}

      {section === "scheduled" && (
        <BatchList
          title="Scheduled Batches"
          slots={scheduledSlots}
          applications={applications}
          saving={saving}
          onComplete={completeBatch}
          onCancel={cancelBatch}
          onDelete={deleteBatch}
          empty="No scheduled interview batches."
        />
      )}

      {section === "completed" && (
        <BatchList
          title="Completed Interviews"
          slots={completedSlots}
          applications={applications}
          saving={saving}
          onComplete={null}
          onCancel={null}
          onDelete={deleteBatch}
          empty="No completed interview batches yet."
        />
      )}
    </div>
  );
}

function BatchList({ title, slots, applications, saving, onComplete, onCancel, onDelete, empty }) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
        <Calendar size={18} /> {title}
      </h2>
      {slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Video size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{empty}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot) => {
            const assignedApps = applications.filter((a) => a.interview_slot_id === slot.id);
            const status = slot.status || "scheduled";
            const statusTone =
              status === "cancelled"
                ? "bg-red-50 text-red-700"
                : status === "completed"
                  ? "bg-green-50 text-green-700"
                  : "bg-indigo-50 text-indigo-700";
            return (
              <div key={slot.id} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">{slot.batch_name}</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(slot.interview_date).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        at {slot.interview_time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {slot.location}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone}`}>
                      {status}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                      <Users size={12} />
                      {assignedApps.length} applicant{assignedApps.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {assignedApps.map((app) => (
                    <Link
                      key={app.id}
                      href={`/director/applications/${app.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
                    >
                      <CheckCircle2 size={12} className="text-green-500" />
                      {applicantLabel(app)}
                    </Link>
                  ))}
                  {assignedApps.length === 0 && (
                    <span className="text-xs text-gray-400">None assigned</span>
                  )}
                </div>
                {status === "scheduled" && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-50 pt-4">
                    {onComplete ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onComplete(slot.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Mark completed
                      </button>
                    ) : null}
                    {onCancel ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onCancel(slot.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel batch
                      </button>
                    ) : null}
                    {assignedApps.length === 0 && onDelete ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onDelete(slot.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Delete empty batch
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
