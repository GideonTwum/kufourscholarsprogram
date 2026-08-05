"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, UserCheck } from "lucide-react";

/**
 * Assign / reassign / unassign assessor for one application (Director).
 */
export default function DirectorAssessorAssignmentPanel({ applicationId, applicationStatus }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [activeAssessors, setActiveAssessors] = useState([]);
  const [assignable, setAssignable] = useState(false);
  const [selectedAssessorId, setSelectedAssessorId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/director/applications/${applicationId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load assignment state");
        setLoading(false);
        return;
      }
      setAssignment(data.assignment || null);
      setLatestAssessment(data.latest_assessment || null);
      const list = data.active_assessors || [];
      setActiveAssessors(list);
      setAssignable(Boolean(data.assignable));
      setSelectedAssessorId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        if (data.assignment?.assessor_id) return data.assignment.assessor_id;
        return list[0]?.id || "";
      });
    } catch {
      setError("Failed to load assignment state");
    }
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load, applicationStatus]);

  async function assign() {
    if (!selectedAssessorId) {
      setError("Select an active assessor.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/director/assessor-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: applicationId,
        assessor_id: selectedAssessorId,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Assignment failed");
      return;
    }
    setSuccess(data.message || "Application assigned successfully.");
    await load();
  }

  async function reassign() {
    if (!selectedAssessorId) {
      setError("Select an active assessor to reassign to.");
      return;
    }
    if (!window.confirm("Reassign this application to the selected assessor? The previous assessor will lose access.")) {
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/director/assessor-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reassign",
        application_id: applicationId,
        new_assessor_id: selectedAssessorId,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Reassign failed");
      return;
    }
    setSuccess(data.message || "Application reassigned.");
    await load();
  }

  async function unassign() {
    if (!window.confirm("Unassign the active assessor? Assessment history will be preserved.")) {
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/director/assessor-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unassign",
        application_id: applicationId,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Unassign failed");
      return;
    }
    setSuccess(data.message || "Assessor unassigned.");
    await load();
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading assessor assignment…
      </div>
    );
  }

  const currentName =
    assignment?.assessor?.full_name ||
    assignment?.assessor?.email ||
    (assignment ? "Assessor" : null);

  return (
    <div className="mt-8 rounded-xl border border-indigo-100 bg-indigo-50/40 p-6 shadow-sm">
      <div className="flex items-start gap-2">
        <UserCheck size={18} className="mt-0.5 text-indigo-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900">Assessor Review</h3>
          <p className="mt-1 text-xs text-gray-600">
            Assign an active assessor to recommend. Official status stays under Director control.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-indigo-100 bg-white p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Assigned to</p>
          <p className="mt-1 break-words font-medium text-gray-900">
            {assignment ? `Assigned to: ${currentName}` : "Unassigned"}
          </p>
          {assignment?.assessor?.email ? (
            <p className="truncate text-xs text-gray-500" title={assignment.assessor.email}>{assignment.assessor.email}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Assignment status</p>
          <p className="mt-1 capitalize text-gray-900">{assignment?.status || "none"}</p>
          <p className="text-xs text-gray-500">
            {assignment?.assigned_at
              ? `Assigned ${new Date(assignment.assigned_at).toLocaleString()}`
              : "—"}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Assessment</p>
          {(() => {
            const assessment = assignment?.assessment || (latestAssessment
              ? {
                  status: "submitted",
                  recommendation: latestAssessment.recommendation,
                  submitted_at: latestAssessment.submitted_at,
                  overall_score: latestAssessment.overall_score,
                }
              : { status: "pending" });
            if (assessment.status === "submitted") {
              return (
                <p className="mt-1 text-gray-900">
                  Submitted
                  {assessment.recommendation
                    ? ` · ${(assessment.recommendation || "").replace(/_/g, " ")}`
                    : ""}
                  {assessment.overall_score != null
                    ? ` · Score ${Number(assessment.overall_score).toFixed(2)}`
                    : ""}
                  {assessment.submitted_at
                    ? ` · ${new Date(assessment.submitted_at).toLocaleString()}`
                    : ""}
                </p>
              );
            }
            return <p className="mt-1 text-gray-500">Pending — no recommendation yet</p>;
          })()}
        </div>
      </div>

      {!assignable ? (
        <p className="mt-4 text-sm text-amber-800">
          This application status is not eligible for assessor assignment.
        </p>
      ) : activeAssessors.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active assessors are available. Create or reactivate an assessor first.{" "}
          <Link href="/director/assessors" className="font-semibold underline">
            Manage assessors
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Select assessor</label>
            <select
              value={selectedAssessorId}
              onChange={(e) => setSelectedAssessorId(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            >
              {activeAssessors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email} ({a.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {!assignment && (
              <button
                type="button"
                disabled={busy || !selectedAssessorId}
                onClick={assign}
                className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
              >
                {busy ? "Working…" : "Assign Assessor"}
              </button>
            )}
            {assignment && (
              <>
                <button
                  type="button"
                  disabled={busy || !selectedAssessorId || selectedAssessorId === assignment.assessor_id}
                  onClick={reassign}
                  className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
                >
                  Reassign
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={unassign}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Unassign
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
