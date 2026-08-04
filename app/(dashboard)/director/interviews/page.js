"use client";

import { useState, useEffect } from "react";
import {
  Video,
  Calendar,
  MapPin,
  Users,
  Loader2,
  CheckCircle2,
  Plus,
  Send,
} from "lucide-react";

export default function DirectorInterviewsPage() {
  const [applications, setApplications] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    batch_name: "",
    interview_date: "",
    interview_time: "",
    location: "",
    congratulations_message: "",
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [success, setSuccess] = useState(null);

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
    return true;
  }

  useEffect(() => {
    async function load() {
      await loadData();
      setLoading(false);
    }
    load();
  }, []);

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllUnassigned() {
    const unassigned = applications
      .filter((a) => !a.interview_slot_id)
      .map((a) => a.id);
    setSelectedIds(new Set(unassigned));
  }

  async function createAndAssign(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const res = await fetch("/api/interview-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        application_ids: Array.from(selectedIds),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create slot");
      setSaving(false);
      return;
    }

    setForm({
      batch_name: "",
      interview_date: "",
      interview_time: "",
      location: "",
      congratulations_message: "",
    });
    setSelectedIds(new Set());

    await loadData();
    setSuccess(
      data.notified
        ? `Batch created and ${data.notified} applicant(s) notified.`
        : "Batch created. Select applicants above to assign them to a batch."
    );
    setSaving(false);
  }

  async function cancelBatch(slotId) {
    if (!window.confirm("Cancel this interview batch and notify assigned applicants?")) return;
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
    setSuccess("Batch cancelled. Assigned applicants were notified.");
    setSaving(false);
  }

  async function completeBatch(slotId) {
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
    setSuccess("Batch marked completed.");
    setSaving(false);
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

  const unassigned = applications.filter((a) => !a.interview_slot_id);
  const assigned = applications.filter((a) => a.interview_slot_id);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Interview Scheduling
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Assign applicants who passed Stage 2 into interview batches. They appear here after Stage 2 is
          approved (or after you called them for interview on their application).
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      {/* Create new batch form */}
      <div className="mb-10 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <Plus size={18} />
          Create New Interview Batch
        </h2>

        <form onSubmit={createAndAssign} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Batch / Group Name
              </label>
              <input
                type="text"
                value={form.batch_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, batch_name: e.target.value }))
                }
                placeholder="e.g. Batch A, Morning Session"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Interview Date
              </label>
              <input
                type="date"
                value={form.interview_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interview_date: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Interview Time
              </label>
              <input
                type="text"
                value={form.interview_time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interview_time: e.target.value }))
                }
                placeholder="e.g. 9:00 AM"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                placeholder="e.g. JAK Foundation, Accra"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Congratulations Message (sent to applicants)
            </label>
            <textarea
              value={form.congratulations_message}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  congratulations_message: e.target.value,
                }))
              }
              rows={2}
              placeholder="Congratulations! You have been selected for an interview. Please arrive 15 minutes early."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          {/* Applicant selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">
                Assign Applicants
              </label>
              {unassigned.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllUnassigned}
                  className="text-xs font-medium text-royal hover:text-gold"
                >
                  Select all ({unassigned.length} unassigned)
                </button>
              )}
            </div>

            {unassigned.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 py-4 text-center text-sm text-gray-500">
                No unassigned applicants right now. You can still create a batch below; assign
                people later when Stage 2–approved applicants appear.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 p-3">
                <div className="space-y-2">
                  {unassigned.map((app) => (
                    <label
                      key={app.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        className="rounded border-gray-300 text-royal focus:ring-gold"
                      />
                      <span className="font-medium text-gray-900">
                        {app.profiles?.full_name || "Unknown"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {app.profiles?.email}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !form.batch_name || !form.interview_date}
            className="flex items-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Create Batch & Assign
          </button>
        </form>
      </div>

      {/* Existing batches */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <Calendar size={18} />
          Scheduled Batches
        </h2>

        {slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Video size={32} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              No interview batches created yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {slots.map((slot) => {
              const assignedApps =
                applications?.filter((a) => a.interview_slot_id === slot.id) ||
                [];
              const status = slot.status || "scheduled";
              const statusTone =
                status === "cancelled"
                  ? "bg-red-50 text-red-700"
                  : status === "completed"
                    ? "bg-green-50 text-green-700"
                    : "bg-indigo-50 text-indigo-700";
              return (
                <div
                  key={slot.id}
                  className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {slot.batch_name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(slot.interview_date).toLocaleDateString(
                            "en-GB",
                            {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}{" "}
                          at {slot.interview_time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {slot.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusTone}`}
                      >
                        {status}
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                        <Users size={12} />
                        {assignedApps.length} applicant
                        {assignedApps.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {slot.congratulations_message && (
                    <p className="mt-3 text-sm italic text-gray-600">
                      &ldquo;{slot.congratulations_message}&rdquo;
                    </p>
                  )}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-gray-500">
                      Assigned applicants
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {assignedApps.map((app) => (
                        <span
                          key={app.id}
                          className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                        >
                          <CheckCircle2 size={12} className="text-green-500" />
                          {app.profiles?.full_name || "Unknown"}
                        </span>
                      ))}
                      {assignedApps.length === 0 && (
                        <span className="text-xs text-gray-400">None assigned</span>
                      )}
                    </div>
                  </div>
                  {status !== "cancelled" && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-50 pt-4">
                      {status === "scheduled" && (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => completeBatch(slot.id)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Mark completed
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => cancelBatch(slot.id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel batch
                          </button>
                        </>
                      )}
                      {assignedApps.length === 0 && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => deleteBatch(slot.id)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Delete empty batch
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
