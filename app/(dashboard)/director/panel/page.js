"use client";

import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Loader2,
  CheckCircle2,
  Mail,
  AlertCircle,
} from "lucide-react";

export default function DirectorPanelPage() {
  const [panelMembers, setPanelMembers] = useState([]);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkMsg, setBulkMsg] = useState({ error: "", success: "" });
  const [rosterForm, setRosterForm] = useState({ full_name: "", email: "", phone: "", role: "" });
  const [addingRoster, setAddingRoster] = useState(false);

  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ email: "", full_name: "" });
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const [lifecycleBusy, setLifecycleBusy] = useState(null);

  useEffect(() => {
    loadPanelMembers();
    loadRoster();
  }, []);

  async function loadRoster() {
    setRosterLoading(true);
    const res = await fetch("/api/director/panel-members");
    const data = await res.json();
    if (res.ok) setRoster(data.panel_members || []);
    setRosterLoading(false);
  }

  async function loadPanelMembers() {
    setLoading(true);
    const res = await fetch("/api/director/panel/accounts");
    const data = await res.json();
    if (res.ok) {
      setPanelMembers(data.panel_accounts || []);
    } else {
      setError(data.error || "Failed to load panel accounts");
    }
    setLoading(false);
  }

  async function lifecycleAction(id, action) {
    if (action === "deactivate") {
      const ok = confirm(
        "Deactivate this panel member? They will no longer be able to log in or submit evaluations. Existing interview scores and evaluation history will be preserved."
      );
      if (!ok) return;
    }
    if (action === "reactivate") {
      const ok = confirm("Reactivate this panel member so they can sign in and score interviews again?");
      if (!ok) return;
    }
    setLifecycleBusy(id);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/director/panel/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setLifecycleBusy(null);
    if (!res.ok) {
      setError(data.error || "Action failed");
      return;
    }
    setSuccess(data.message || "Updated.");
    loadPanelMembers();
  }

  async function permanentlyDelete(id) {
    const member = panelMembers.find((m) => m.id === id);
    if ((member?.evaluation_count || 0) > 0) {
      setError(
        "This panel member has interview evaluation history and cannot be permanently deleted. Deactivate the account instead."
      );
      return;
    }
    const ok = confirm(
      "Permanently delete this panel member account? This cannot be undone and is only allowed when the member has no interview evaluation history."
    );
    if (!ok) return;
    setLifecycleBusy(id);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/director/panel/${id}`, { method: "DELETE" });
    const data = await res.json();
    setLifecycleBusy(null);
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setSuccess(data.message || "Deleted.");
    loadPanelMembers();
  }

  async function addToRoster(e) {
    e.preventDefault();
    setBulkMsg({ error: "", success: "" });
    setAddingRoster(true);
    const res = await fetch("/api/director/panel-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rosterForm),
    });
    const data = await res.json();
    setAddingRoster(false);
    if (!res.ok) {
      setBulkMsg({ success: "", error: data.error || "Failed to add contact" });
      return;
    }
    setBulkMsg({ error: "", success: "Contact added." });
    setRosterForm({ full_name: "", email: "", phone: "", role: "" });
    loadRoster();
  }

  async function removeRoster(id) {
    if (!confirm("Remove this roster entry?")) return;
    await fetch(`/api/director/panel-members?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    loadRoster();
    setSelectedRosterIds((prev) => prev.filter((x) => x !== id));
  }

  async function sendRosterEmails(e) {
    e.preventDefault();
    setBulkMsg({ error: "", success: "" });
    if (!emailSubject.trim() || !emailBody.trim() || selectedRosterIds.length === 0) {
      setBulkMsg({
        success: "",
        error: "Select recipients and enter subject and message.",
      });
      return;
    }
    setSendingBulk(true);
    const res = await fetch("/api/director/email-panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panel_member_ids: selectedRosterIds,
        subject: emailSubject.trim(),
        message: emailBody.trim(),
      }),
    });
    const data = await res.json();
    setSendingBulk(false);
    if (!res.ok) {
      setBulkMsg({ success: "", error: data.error || "Send failed." });
      return;
    }
    setBulkMsg({ error: "", success: `Sent to ${data.recipients ?? selectedRosterIds.length} recipient(s).` });
  }

  function toggleRoster(id) {
    setSelectedRosterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setCreatedCredentials(null);
    setInviting(true);

    const res = await fetch("/api/director/panel/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        full_name: form.full_name.trim() || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create panel account");
      setInviting(false);
      return;
    }

    setCreatedCredentials({
      email: data.email,
      temporary_password: data.temporary_password,
      login_url: data.login_url || "/panel-login",
    });
    setSuccess(data.message || "Panel account created.");
    setForm({ email: "", full_name: "" });
    setInviting(false);
    loadPanelMembers();
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel Members</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create panel login credentials for interview scoring. Panel members sign in at /panel-login (no public signup).
        </p>
      </div>

      {/* Create account form */}
      <div className="mb-10 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <UserPlus size={18} />
          Create Panel Account
        </h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        {createdCredentials && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
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
              Share securely. Passwords are not stored in plain text in the database.
            </p>
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="panel.member@example.com"
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Dr. Jane Doe"
              className="w-full rounded-lg border border-gray-200 py-2.5 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              required
            />
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="flex items-center gap-2 rounded-lg bg-royal px-5 py-2.5 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
          >
            {inviting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <UserPlus size={16} />
            )}
            Create account
          </button>
        </form>
      </div>

      {/* Panel members list */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <Users size={18} />
          Current Panel Members ({panelMembers.length})
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-royal" />
          </div>
        ) : panelMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Users size={32} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No panel members yet.</p>
            <p className="mt-1 text-xs text-gray-400">Invite someone using the form above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {panelMembers.map((member) => {
              const active = member.is_active !== false;
              const evalCount = member.evaluation_count || 0;
              const busy = lifecycleBusy === member.id;
              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-royal/10 text-royal">
                      {(member.full_name || member.email)
                        ?.split(/[\s@]/)[0]
                        ?.slice(0, 2)
                        ?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="font-medium text-gray-900">{member.full_name || "—"}</p>
                      <p className="truncate text-sm text-gray-500">{member.email}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {evalCount} evaluation{evalCount === 1 ? "" : "s"}
                        {member.created_at
                          ? ` · Created ${new Date(member.created_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        active
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>
                    {active ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => lifecycleAction(member.id, "deactivate")}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busy ? "…" : "Deactivate"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => lifecycleAction(member.id, "reactivate")}
                        className="rounded-lg border border-royal/30 bg-royal/5 px-3 py-1.5 text-xs font-medium text-royal hover:bg-royal/10 disabled:opacity-50"
                      >
                        {busy ? "…" : "Reactivate"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || evalCount > 0}
                      title={
                        evalCount > 0
                          ? "Cannot permanently delete — evaluation history exists. Deactivate instead."
                          : "Permanently delete unused account"
                      }
                      onClick={() => permanentlyDelete(member.id)}
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

      <div className="mt-12 border-t border-gray-100 pt-10">
        <h2 className="mb-2 text-xl font-bold text-gray-900">Panel roster & email</h2>
        <p className="mb-6 text-sm text-gray-500">
          Contacts for briefing emails (separate from panel portal accounts above). Select recipients and send from the platform.
        </p>

        {bulkMsg.error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} /> {bulkMsg.error}
          </div>
        )}
        {bulkMsg.success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 size={16} /> {bulkMsg.success}
          </div>
        )}

        <form onSubmit={addToRoster} className="mb-10 grid gap-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Full name</label>
            <input
              value={rosterForm.full_name}
              onChange={(e) => setRosterForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
            <input
              type="email"
              value={rosterForm.email}
              onChange={(e) => setRosterForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Phone</label>
            <input
              value={rosterForm.phone}
              onChange={(e) => setRosterForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={addingRoster}
              className="w-full rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50 md:w-auto"
            >
              {addingRoster ? "Adding…" : "Add"}
            </button>
          </div>
        </form>

        {rosterLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-royal" />
          </div>
        ) : (
          <div className="space-y-2">
            {roster.map((row) => (
              <label
                key={row.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedRosterIds.includes(row.id)}
                  onChange={() => toggleRoster(row.id)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{row.full_name}</p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    removeRoster(row.id);
                  }}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              </label>
            ))}
            {roster.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 bg-white py-10 text-center text-sm text-gray-500">
                No roster contacts yet. Add emails above.
              </p>
            )}
          </div>
        )}

        <form onSubmit={sendRosterEmails} className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-gray-900">Send email</h3>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Subject</label>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Message</label>
            <textarea
              rows={6}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={sendingBulk || selectedRosterIds.length === 0}
            className="mt-6 flex items-center gap-2 rounded-lg bg-gold px-6 py-2.5 text-sm font-semibold text-royal hover:bg-gold/90 disabled:opacity-50"
          >
            {sendingBulk ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Send email
          </button>
        </form>
      </div>
    </div>
  );
}
