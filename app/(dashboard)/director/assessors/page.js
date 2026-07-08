"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, UserPlus, Users } from "lucide-react";

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
  const [message, setMessage] = useState({ error: "", success: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/director/assessors");
    const data = await res.json();
    if (res.ok) {
      setAssessors(data.assessors || []);
      setApplications(data.applications || []);
      setAssignments(data.assignments || []);
      if (!selectedAssessor && data.assessors?.[0]) setSelectedAssessor(data.assessors[0].id);
    } else {
      setMessage({ success: "", error: data.error || "Failed to load assessors." });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const assignedByApplication = useMemo(() => {
    const map = {};
    assignments.forEach((row) => {
      map[row.application_id] = row.assessor_id;
    });
    return map;
  }, [assignments]);

  async function inviteAssessor(e) {
    e.preventDefault();
    setBusy(true);
    setMessage({ error: "", success: "" });
    const res = await fetch("/api/assessor/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ success: "", error: data.error || "Invite failed." });
      return;
    }
    setInviteForm({ full_name: "", email: "" });
    setMessage({ error: "", success: data.message || "Invite sent." });
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

  function toggleApplication(id) {
    setSelectedApplications((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Assessors</h1>
        <p className="mt-1 text-sm text-gray-500">
          Invite assessor accounts and assign applicants for pre-interview review.
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

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-8">
          <form onSubmit={inviteAssessor} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <UserPlus size={18} /> Invite Assessor
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Full name</label>
                <input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Dr. Jane Doe"
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
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Send invite
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
              <p className="text-sm text-gray-500">No assessors invited yet.</p>
            ) : (
              <div className="space-y-3">
                {assessors.map((assessor) => (
                  <div key={assessor.id} className="rounded-lg border border-gray-100 p-3">
                    <p className="font-medium text-gray-900">{assessor.full_name || "—"}</p>
                    <p className="text-sm text-gray-500">{assessor.email}</p>
                    <p className="mt-1 text-xs font-semibold text-royal">
                      {assessor.active_assignment_count || 0} active assignment(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={assignApplications} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900">Assign Applicants</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select an assessor, then assign applicants awaiting review. Target load is about 200 applicants per assessor.
          </p>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-medium text-gray-500">Assessor</label>
            <select
              value={selectedAssessor}
              onChange={(e) => setSelectedAssessor(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select assessor</option>
              {assessors.map((assessor) => (
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
                  <label
                    key={app.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedApplications.includes(app.id)}
                      disabled={!!assignedTo && assignedTo !== selectedAssessor}
                      onChange={() => toggleApplication(app.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{applicantName(app)}</p>
                      <p className="text-xs text-gray-500">
                        {app.profiles?.email || "No email"} · {app.university || "No university"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-royal">
                        {app.status?.replace(/_/g, " ") || "—"}
                      </p>
                      {assignedTo && assignedTo !== selectedAssessor && (
                        <p className="mt-1 text-xs text-amber-700">Already assigned to another assessor</p>
                      )}
                    </div>
                  </label>
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
