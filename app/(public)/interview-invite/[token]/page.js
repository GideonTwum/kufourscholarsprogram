"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function InterviewInvitePage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/interview-invite/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "This invitation link is not valid.");
      setData(null);
      return;
    }
    setError("");
    setData(json);
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function respond(action) {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/interview-invite/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || "Could not save response");
      return;
    }
    setMessage("Response saved. Your assigned batch was not changed.");
    await load();
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-bold text-gray-900">Interview invitation</h1>
        <p className="mt-4 text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-gray-500">Loading invitation…</p>
      </main>
    );
  }

  const interview = data.interview;
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-royal">{data.source_label}</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Hello {data.full_name}</h1>
      <p className="mt-1 text-sm text-gray-600">Recommended by {data.university}</p>
      {interview ? (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="font-medium text-gray-900">
            {interview.date} · {interview.start_time}
            {interview.end_time ? `–${interview.end_time}` : ""}
          </p>
          <p className="mt-1 text-sm text-gray-700">{interview.venue}</p>
          <p className="mt-3 text-sm text-gray-600">
            Please report to the John A. Kufuor Foundation 15 minutes before the assigned batch time.
            Bring three hard copies of an updated CV and one photocopy of your WASSCE and/or NovDec
            results, as applicable.
          </p>
          <p className="mt-3 text-sm font-medium text-gray-800">
            Status: {data.response_status || "awaiting_response"}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => respond("confirm_attendance")}
            className="mt-4 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm attendance
          </button>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for a virtual or reschedule request"
            className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" disabled={saving} onClick={() => respond("virtual")} className="text-sm font-medium text-royal">
              Request virtual interview
            </button>
            <button type="button" disabled={saving} onClick={() => respond("reschedule")} className="text-sm font-medium text-royal">
              Request reschedule
            </button>
          </div>
          {message ? <p className="mt-3 text-sm text-green-800">{message}</p> : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-gray-600">Your interview details will appear here once a batch is published.</p>
      )}
    </main>
  );
}
