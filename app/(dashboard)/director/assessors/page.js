"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import {
  assessorDisplayName,
  classifyAssignmentCardState,
  filterAssignableSelection,
  formatAssignedDate,
} from "@/lib/assessor-assignment";

function applicantName(app) {
  return (
    app.applicant_name ||
    app.full_name ||
    app.profiles?.full_name ||
    app.email ||
    app.profiles?.email ||
    "Applicant"
  );
}

function applicantEmail(app) {
  return app.email || app.profiles?.email || "No email";
}

function AssignmentStateBadge({ state, assessorName }) {
  if (state === "assigned_to_selected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
        <CheckCircle2 size={12} aria-hidden="true" />
        Assigned to {assessorName}
      </span>
    );
  }
  if (state === "assigned_to_other") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
        <UserRound size={12} aria-hidden="true" />
        Assigned to {assessorName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
      <UserCheck size={12} aria-hidden="true" />
      Unassigned
    </span>
  );
}

export default function DirectorAssessorsPage() {
  const [loading, setLoading] = useState(true);
  const [assessors, setAssessors] = useState([]);
  const [applications, setApplications] = useState([]);
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
      const nextAssessors = data.assessors || [];
      const nextApps = data.applications || [];
      setAssessors(nextAssessors);
      setApplications(nextApps);
      const active = nextAssessors.filter((a) => a.is_active !== false);
      setSelectedAssessor((prev) => {
        if (prev && active.some((a) => a.id === prev)) return prev;
        return active[0]?.id || "";
      });
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

  const selectedAssessorProfile = useMemo(
    () => activeAssessors.find((a) => a.id === selectedAssessor) || null,
    [activeAssessors, selectedAssessor]
  );

  const selectedAssessorName = assessorDisplayName(selectedAssessorProfile);

  const applicationsById = useMemo(
    () => Object.fromEntries(applications.map((app) => [app.id, app])),
    [applications]
  );

  // Keep checkboxes in sync: apps already assigned to the selected assessor stay checked.
  useEffect(() => {
    if (!selectedAssessor) {
      setSelectedApplications([]);
      return;
    }
    setSelectedApplications((prev) => {
      const assignedToSelected = applications
        .filter(
          (app) =>
            classifyAssignmentCardState(app.current_assignment, selectedAssessor) ===
            "assigned_to_selected"
        )
        .map((app) => app.id);
      const kept = prev.filter((id) => {
        const app = applicationsById[id];
        if (!app) return false;
        const state = classifyAssignmentCardState(app.current_assignment, selectedAssessor);
        return state !== "assigned_to_selected";
      });
      return [...new Set([...assignedToSelected, ...kept])];
    });
  }, [selectedAssessor, applications, applicationsById]);

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

    const { toProcess, alreadyAssigned, toReassign } = filterAssignableSelection(
      selectedApplications,
      applicationsById,
      selectedAssessor
    );

    if (toProcess.length === 0) {
      setMessage({
        success: "",
        error:
          alreadyAssigned.length > 0
            ? "All selected applicants are already assigned to this assessor. Use Unassign to remove an assignment."
            : "Select at least one applicant to assign.",
      });
      return;
    }

    if (toReassign.length > 0) {
      const lines = toReassign.slice(0, 5).map((id) => {
        const app = applicationsById[id];
        const fromName = assessorDisplayName(app?.current_assignment?.assessor);
        return `${applicantName(app)} (currently ${fromName})`;
      });
      const more = toReassign.length > 5 ? `\n…and ${toReassign.length - 5} more` : "";
      const ok = confirm(
        `Reassign ${toReassign.length} applicant(s) to ${selectedAssessorName}?\n\n${lines.join("\n")}${more}\n\nPrevious assignment history will be preserved.`
      );
      if (!ok) return;
    }

    setBusy(true);
    setMessage({ error: "", success: "" });
    const res = await fetch("/api/director/assessor-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessor_id: selectedAssessor,
        application_ids: toProcess,
        force_reassign: toReassign.length > 0,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Assignment failed." });
      return;
    }
    const skippedNote =
      alreadyAssigned.length > 0
        ? ` Skipped ${alreadyAssigned.length} already assigned to ${selectedAssessorName}.`
        : "";
    setMessage({
      error: "",
      success: `Assigned ${data.assigned || toProcess.length} applicant(s) to ${selectedAssessorName}.${skippedNote}`,
    });
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
    setSelectedApplications((prev) => prev.filter((id) => id !== applicationId));
    setMessage({ error: "", success: data.message || "Unassigned." });
    load();
  }

  function toggleApplication(app) {
    const state = classifyAssignmentCardState(app.current_assignment, selectedAssessor);
    if (state === "assigned_to_selected") return;
    setSelectedApplications((prev) =>
      prev.includes(app.id) ? prev.filter((x) => x !== app.id) : [...prev, app.id]
    );
  }

  function checkboxLabel(app, state) {
    const name = applicantName(app);
    if (state === "assigned_to_selected") {
      return `${name} is assigned to ${selectedAssessorName}`;
    }
    if (state === "assigned_to_other") {
      const other = assessorDisplayName(app.current_assignment?.assessor);
      return `Select ${name} for reassignment from ${other} to ${selectedAssessorName}`;
    }
    return `Select unassigned applicant ${name}`;
  }

  function cardClass(state, checked) {
    if (state === "assigned_to_selected") {
      return "border-green-200 bg-green-50/40";
    }
    if (state === "assigned_to_other" && checked) {
      return "border-amber-200 bg-amber-50/50";
    }
    if (state === "assigned_to_other") {
      return "border-amber-100 bg-white";
    }
    if (checked) {
      return "border-royal/20 bg-royal/[0.03]";
    }
    return "border-gray-100 bg-white";
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

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
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
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{assessor.full_name || "—"}</p>
                          <p className="truncate text-sm text-gray-500">{assessor.email}</p>
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
            One active assessor per applicant. Cards show who currently owns each assignment. Assigning
            when another assessor is active will reassign after confirmation. Inactive assessors are
            excluded.
          </p>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-gray-500">Assessor</label>
            <select
              value={selectedAssessor}
              onChange={(e) => {
                setSelectedAssessor(e.target.value);
                setSelectedApplications([]);
              }}
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
                const state = classifyAssignmentCardState(app.current_assignment, selectedAssessor);
                const checked = selectedApplications.includes(app.id);
                const currentName = assessorDisplayName(app.current_assignment?.assessor);
                const assignedDate = formatAssignedDate(app.current_assignment?.assigned_at);
                const assessment = app.current_assignment?.assessment;
                const assessmentLabel =
                  assessment?.status === "submitted"
                    ? `Assessment submitted${
                        assessment.recommendation
                          ? ` · ${String(assessment.recommendation).replace(/_/g, " ")}`
                          : ""
                      }`
                    : state === "unassigned"
                      ? null
                      : "Assessment: Pending";

                return (
                  <div
                    key={app.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${cardClass(state, checked)}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectedAssessor || state === "assigned_to_selected"}
                      onChange={() => toggleApplication(app)}
                      className="mt-1"
                      aria-label={checkboxLabel(app, state)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{applicantName(app)}</p>
                          <p className="truncate text-xs text-gray-500">
                            {applicantEmail(app)} · {app.university || "No university"}
                          </p>
                        </div>
                        <AssignmentStateBadge
                          state={state}
                          assessorName={
                            state === "assigned_to_selected" ? selectedAssessorName : currentName
                          }
                        />
                      </div>

                      <p className="mt-1 text-xs font-semibold capitalize text-royal">
                        {(app.status || "—").replace(/_/g, " ")}
                      </p>

                      {assignedDate ? (
                        <p className="mt-1 text-xs text-gray-500">Assigned on {assignedDate}</p>
                      ) : null}
                      {assessmentLabel ? (
                        <p className="mt-0.5 text-xs text-gray-500">{assessmentLabel}</p>
                      ) : null}

                      {state === "assigned_to_other" ? (
                        <p className="mt-2 text-xs text-amber-800">
                          {checked
                            ? `Selecting this applicant will reassign them to ${selectedAssessorName}.`
                            : `Currently assigned to ${currentName}. Select to reassign to ${
                                selectedAssessorName || "the chosen assessor"
                              }.`}
                        </p>
                      ) : null}

                      {state === "assigned_to_selected" ? (
                        <p className="mt-2 text-xs text-green-800">
                          Already assigned to {selectedAssessorName}. Use Unassign to remove.
                        </p>
                      ) : null}

                      {app.current_assignment ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => unassignApplication(app.id)}
                          className="mt-2 text-xs font-medium text-gray-600 underline hover:text-royal"
                        >
                          Unassign
                        </button>
                      ) : null}
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
