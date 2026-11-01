"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/read-response-json";

function appointmentLabel(apt) {
  if (!apt) return "No assigned batch";
  const date = apt.date || "";
  const time = apt.start_time && apt.end_time ? `${apt.start_time}–${apt.end_time}` : apt.start_time || "";
  return [date, time, apt.batch_name].filter(Boolean).join(" · ") || "Batch";
}

export default function DirectorInterviewRequestsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requests, setRequests] = useState([]);
  const [review, setReview] = useState(null);
  const [available, setAvailable] = useState([]);

  const load = useCallback(async () => {
    const { ok, data } = await fetchJson("/api/director/interview-requests");
    if (!ok) {
      setError(data.error || "Could not load interview requests");
      setRequests([]);
      return false;
    }
    setError("");
    setRequests(data.requests || []);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function openReview(row) {
    setError("");
    setSuccess("");
    const next = {
      ...row,
      meeting_link: "",
      meeting_instructions: "",
      director_notes: row.director_notes || "",
      replacement_appointment_id: "",
      replacement_interview_slot_id: "",
    };
    setReview(next);
    if (row.request_type === "reschedule") {
      await loadAvailable();
    } else {
      setAvailable([]);
    }
  }

  async function loadAvailable() {
    const { ok, data } = await fetchJson("/api/director/interview-slots");
    if (!ok) {
      setAvailable([]);
      setError(data.error || "Could not load available batches");
      return;
    }
    setAvailable(
      (data.slots || []).filter((slot) => (slot.status || "scheduled") === "scheduled" && !slot.full)
    );
  }

  async function decide(status) {
    if (!review) return;
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: review.id,
        status,
        director_notes: review.director_notes,
        meeting_link: review.meeting_link,
        meeting_instructions: review.meeting_instructions,
        replacement_appointment_id: review.replacement_appointment_id || undefined,
        replacement_interview_slot_id:
          review.replacement_interview_slot_id || review.replacement_appointment_id || undefined,
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not save decision");
      return;
    }
    setSuccess(
      status === "approved"
        ? "Request approved. The original batch stayed reserved until a replacement was saved."
        : "Request declined. The original batch was kept."
    );
    setReview(null);
    await load();
  }

  const pending = requests.filter((row) => row.status === "pending");
  const decided = requests.filter((row) => row.status !== "pending").slice(0, 12);

  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">Applicant responses and requests</h2>
      <p className="mt-1 text-xs text-gray-500">
        Requests never change a batch assignment automatically. Approve a reschedule only after choosing a
        replacement batch. Email replies are not imported.
      </p>
      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}
      {success ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {success}
        </div>
      ) : null}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-royal" />
        </div>
      ) : pending.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No pending requests.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((row) => (
            <li key={row.id} className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{row.full_name}</p>
                  <p className="text-xs uppercase tracking-wide text-amber-800">{row.request_type}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Study location: {row.study_region} · {row.study_town} · {row.study_institution}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">{appointmentLabel(row.current_appointment)}</p>
                  <p className="mt-1 text-sm text-gray-700">{row.reason}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Submitted {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                  </p>
                  {row.notification_status ? (
                    <p className="mt-1 text-[11px] text-gray-600">
                      Reschedule notice: {row.notification_status}
                      {row.previous_interview_date
                        ? ` · ${row.previous_interview_date} ${row.previous_interview_time || ""} → ${row.new_interview_date || ""} ${row.new_interview_time || ""}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => openReview(row)}
                  className="rounded-lg bg-royal px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Review
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {decided.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500">
            Recent decisions:{" "}
            {decided
              .map((row) => `${row.full_name} (${row.request_type} ${row.status}${row.notification_status ? ` · notice ${row.notification_status}` : ""})`)
              .join(" · ")}
          </p>
          {decided
            .filter((row) => row.request_type === "reschedule" && row.notification_status === "failed")
            .map((row) => (
              <button
                key={`retry-${row.id}`}
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError("");
                  const { ok, data } = await fetchJson("/api/director/interview-requests", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: row.id, action: "retry_notification" }),
                  });
                  setSaving(false);
                  if (!ok || !data.notified) {
                    setError(data.error || "Reschedule notice could not be sent. You can retry.");
                    return;
                  }
                  setSuccess("Reschedule notice sent.");
                  await load();
                }}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
              >
                Retry notice for {row.full_name}
              </button>
            ))}
        </div>
      ) : null}

      {review ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Review {review.request_type} request</h3>
            <p className="mt-2 text-sm text-gray-700">{review.full_name}</p>
            <p className="mt-1 text-sm text-gray-600">
              Study location: {review.study_region} · {review.study_town} · {review.study_institution}
            </p>
            <p className="mt-1 text-sm text-gray-600">{appointmentLabel(review.current_appointment)}</p>
            <p className="mt-2 text-sm text-gray-700">{review.reason}</p>
            {review.request_type === "virtual" ? (
              <>
                <label className="mt-4 block text-xs font-medium text-gray-500">
                  Meeting link (required to approve)
                  <input
                    value={review.meeting_link}
                    onChange={(e) => setReview((prev) => ({ ...prev, meeting_link: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Only the invited applicant will see this"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-gray-500">
                  Meeting instructions
                  <textarea
                    value={review.meeting_instructions}
                    onChange={(e) =>
                      setReview((prev) => ({ ...prev, meeting_instructions: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    rows={3}
                  />
                </label>
              </>
            ) : null}
            {review.request_type === "reschedule" ? (
              <>
                <label className="mt-4 block text-xs font-medium text-gray-500">
                  Replacement batch
                  <select
                    value={review.replacement_appointment_id}
                    onChange={(e) =>
                      setReview((prev) => ({
                        ...prev,
                        replacement_appointment_id: e.target.value,
                        replacement_interview_slot_id: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Select an available batch</option>
                    {available.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.batch_name} · {slot.interview_date} {slot.interview_time}
                        {slot.end_time ? `–${slot.end_time}` : ""}
                        {slot.available != null ? ` · ${slot.available} open` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  The current batch stays assigned until this replacement is saved.
                </p>
              </>
            ) : null}
            <label className="mt-3 block text-xs font-medium text-gray-500">
              Director notes
              <textarea
                value={review.director_notes}
                onChange={(e) => setReview((prev) => ({ ...prev, director_notes: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                rows={2}
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setReview(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Leave pending
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => decide("declined")}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  (review.request_type === "virtual" && !review.meeting_link.trim()) ||
                  (review.request_type === "reschedule" && !review.replacement_appointment_id)
                }
                onClick={() => decide("approved")}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Approve
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
