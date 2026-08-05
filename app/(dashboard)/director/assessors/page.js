"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UserPlus, Users } from "lucide-react";

function applicantName(app) {
  return app.full_name || app.profiles?.full_name || app.profiles?.email || "Applicant";
}

export default function DirectorAssessorsPage() {
  const [loading, setLoading] = useState(true);
  const [assessors, setAssessors] = useState([]);
  const [applications, setApplications] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssessor, setSelectedAssessor] = useState("");
  const [selectedApplications, setSelectedApplications] = useState([]);
  const [inviteForm, setInviteForm] = useState({ full_name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(null);
  const [message, setMessage] = useState({ error: "", success: "" });
  const [createdCredentials, setCreatedCredentials] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/director/assessors");
    const data = await res.json();
    if (res.ok) {
      setAssessors(data.assessors || []);
      setApplications(data.applications || []);
      setAssignments(data.assignments || []);
      const active = (data.assessors || []).filter((a) => a.is_active !== false);
      if (!selectedAssessor && active[0]) setSelectedAssessor(active[0].id);
    } else {
      setMessage({ success: "", error: data.error || "Failed to load assessors." });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeAssessors = useMemo(
    () => assessors.filter((a) => a.is_active !== false),
    [assessors]
  );

  const assignedByApplication = useMemo(() => {
    const map = {};
    assignments.forEach((row) => {
      map[row.application_id] = row.assessor_id;
    });
    return map;
  }, [assignments]);

  async function createAssessor(e) {
    e.preventDefault();
    setBusy(true);
    setMessage({ error: "", success: "" });
    setCreatedCredentials(null);
    const res = await fetch("/api/director/assessors/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Create failed." });
      return;
    }
    setInviteForm({ full_name: "", email: "" });
    setCreatedCredentials({
      email: data.email,
      temporary_password: data.temporary_password,
      login_url: data.login_url || "/assessor-login",
    });
    setMessage({
      error: "",
      success: data.message || "Assessor account created. Copy the password now.",
    });
    load();
  }

  async function assignApplications(e) {
    e.preventDefault();
    if (!selectedAssessor || selectedApplications.length === 0) {
      setMessage({ success: "", error: "Select an assessor and at least one applicant." });
      return;
    }
    setBusy(true);
    setMessage({ error: "", success: "" });
    const res = await fetch("/api/director/assessor-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessor_id: selectedAssessor,
        application_ids: selectedApplications,
        force_reassign: true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Assignment failed." });
      return;
    }
    setSelectedApplications([]);
    setMessage({ error: "", success: `Assigned ${data.assigned || selectedApplications.length} applicant(s).` });
    load();
  }

  async function lifecycleAction(id, action) {
    if (action === "deactivate") {
      const ok = confirm(
        "Deactivate this assessor? They will no longer be able to log in or receive assignments. Existing assignments and assessment history will be preserved."
      );
      if (!ok) return;
    }
    if (action === "reactivate") {
      const ok = confirm("Reactivate this assessor so they can sign in and receive assignments again?");
      if (!ok) return;
    }
    setLifecycleBusy(id);
    setMessage({ error: "", success: "" });
    const res = await fetch(`/api/director/assessors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setLifecycleBusy(null);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Action failed" });
      return;
    }
    setMessage({ error: "", success: data.message || "Updated." });
    load();
  }

  async function permanentlyDelete(id) {
    const member = assessors.find((m) => m.id === id);
    if ((member?.assessment_count || 0) > 0 || (member?.assignment_count || 0) > 0) {
      setMessage({
        success: "",
        error:
          "This assessor has assignment or assessment history and cannot be permanently deleted. Deactivate the account instead.",
      });
      return;
    }
    const ok = confirm(
      "Permanently delete this assessor account? This is only allowed when the assessor has no assignment or assessment history."
    );
    if (!ok) return;
    setLifecycleBusy(id);
    setMessage({ error: "", success: "" });
    const res = await fetch(`/api/director/assessors/${id}`, { method: "DELETE" });
    const data = await res.json();
    setLifecycleBusy(null);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Delete failed" });
      return;
    }
    setMessage({ error: "", success: data.message || "Deleted." });
    if (selectedAssessor === id) setSelectedAssessor("");
    load();
  }

  async function unassignApplication(applicationId) {
    const ok = confirm(
      "Unassign the active assessor from this applicant? Assessment history will be preserved."
    );
    if (!ok) return;
    setBusy(true);
    setMessage({ error: "", success: "" });
    const res = await fetch("/api/director/assessor-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unassign", application_id: applicationId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Unassign failed" });
      return;
    }
    setMessage({ error: "", success: data.message || "Unassigned." });
    load();
  }

  function toggleApplication(id) {
    setSelectedApplications((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assessors</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create assessor credentials, assign applicants, and manage account lifecycle. Assessors recommend
          only — Directors make official status decisions. Login: /assessor-login (no public signup).
        </p>
      </div>

      {message.error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {message.error}
        </div>
      )}
      {message.success && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> {message.success}
        </div>
      )}

      {createdCredentials && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Temporary credentials (shown once)</p>
          <p className="mt-2">
            Email: <code className="rounded bg-white px-1">{createdCredentials.email}</code>
          </p>
          <p className="mt-1">
            Password:{" "}
            <code className="rounded bg-white px-1">{createdCredentials.temporary_password}</code>
          </p>
          <p className="mt-1">
            Login: <code className="rounded bg-white px-1">{createdCredentials.login_url}</code>
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-royal px-3 py-1.5 text-xs font-semibold text-white"
            onClick={() => {
              const text = `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.temporary_password}\nLogin: ${typeof window !== "undefined" ? window.location.origin : ""}${createdCredentials.login_url}`;
              navigator.clipboard?.writeText(text);
            }}
          >
            Copy credentials
          </button>
          <p className="mt-2 text-xs text-amber-800">
            Share securely out of band. Passwords are not stored. Leave this page and the password cannot be recovered from the app.
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-8">
          <form onSubmit={createAssessor} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <UserPlus size={18} /> Create Assessor Account
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Full name</label>
                <input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Dr. Jane Doe"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="assessor@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Create account
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <Users size={18} /> Current Assessors
            </h2>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-royal" />
            ) : assessors.length === 0 ? (
              <p className="text-sm text-gray-500">No assessors yet.</p>
            ) : (
              <div className="space-y-3">
                {assessors.map((assessor) => {
                  const active = assessor.is_active !== false;
                  const busyId = lifecycleBusy === assessor.id;
                  const hasHistory =
                    (assessor.assessment_count || 0) > 0 || (assessor.assignment_count || 0) > 0;
                  return (
                    <div key={assessor.id} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">{assessor.full_name || "—"}</p>
                          <p className="text-sm text-gray-500">{assessor.email}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {assessor.active_assignment_count || 0} active ·{" "}
                            {assessor.assessment_count || 0} assessment(s)
                            {assessor.created_at
                              ? ` · Created ${new Date(assessor.created_at).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {active ? (
                          <button
                            type="button"
                            disabled={busyId}
                            onClick={() => lifecycleAction(assessor.id, "deactivate")}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId}
                            onClick={() => lifecycleAction(assessor.id, "reactivate")}
                            className="rounded-lg border border-royal/30 bg-royal/5 px-3 py-1.5 text-xs font-medium text-royal disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId || hasHistory}
                          title={
                            hasHistory
                              ? "Cannot permanently delete — history exists. Deactivate instead."
                              : "Permanently delete unused account"
                          }
                          onClick={() => permanentlyDelete(assessor.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Permanently Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={assignApplications} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900">Assign Applicants</h2>
          <p className="mt-1 text-sm text-gray-500">
            One active assessor per applicant. Assigning when another assessor is active will reassign.
            Inactive assessors are excluded.
          </p>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-gray-500">Assessor</label>
            <select
              value={selectedAssessor}
              onChange={(e) => setSelectedAssessor(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select assessor</option>
              {activeAssessors.map((assessor) => (
                <option key={assessor.id} value={assessor.id}>
                  {assessor.full_name || assessor.email} ({assessor.active_assignment_count || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-royal" />
              </div>
            ) : applications.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                No applications currently awaiting assessor review.
              </p>
            ) : (
              applications.map((app) => {
                const assignedTo = assignedByApplication[app.id];
                return (
                  <div
                    key={app.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedApplications.includes(app.id)}
                      onChange={() => toggleApplication(app.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{applicantName(app)}</p>
                      <p className="text-xs text-gray-500">
                        {app.profiles?.email || "No email"} · {app.university || "No university"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-royal">
                        {app.status?.replace(/_/g, " ") || "—"}
                      </p>
                      {assignedTo && assignedTo !== selectedAssessor && (
                        <p className="mt-1 text-xs text-amber-700">
                          Currently assigned to another assessor — assigning will reassign
                        </p>
                      )}
                      {assignedTo && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => unassignApplication(app.id)}
                          className="mt-2 text-xs font-medium text-gray-600 underline hover:text-royal"
                        >
                          Unassign
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !selectedAssessor || selectedApplications.length === 0}
            className="mt-6 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-royal disabled:opacity-50"
          >
            Assign selected ({selectedApplications.length})
          </button>
        </form>
      </div>
    </div>
  );
}
