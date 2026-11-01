"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { fetchJson } from "@/lib/read-response-json";
import { assignmentRowState } from "@/lib/director-interview-assignment";
import { UNIVERSITY_INVITEE_LABEL } from "@/lib/director-interview-invitees";

const emptyForm = {
  full_name: "",
  university: "",
  email: "",
  whatsapp_phone: "",
  nationality: "",
  programme_of_study: "",
};

export default function DirectorSpecialInviteesPanel() {
  const [invitees, setInvitees] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [targetBatchId, setTargetBatchId] = useState("");
  const [whatsappPreview, setWhatsappPreview] = useState(null);

  async function load() {
    const { ok, data } = await fetchJson("/api/director/interview-slots");
    if (!ok) {
      setError(data.error || "Could not load special invitees");
      return false;
    }
    setInvitees(data.invitees || []);
    setSlots(data.slots || []);
    setUnavailable(data.invitees_unavailable === true);
    return true;
  }

  useEffect(() => {
    async function run() {
      await load();
      setLoading(false);
    }
    run();
  }, []);

  const assignableSlots = useMemo(
    () => (slots || []).filter((slot) => (slot.status || "scheduled") === "scheduled"),
    [slots]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitees;
    return invitees.filter((row) =>
      `${row.full_name} ${row.university} ${row.email} ${row.whatsapp_phone}`.toLowerCase().includes(q)
    );
  }, [invitees, search]);

  async function createInvitee(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const { ok, data } = await fetchJson("/api/director/interview-invitees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not save invitee");
      return;
    }
    setForm(emptyForm);
    setShowCreate(false);
    await load();
    setSuccess("University invitee saved. No messages were sent.");
  }

  async function assignInvitee(row) {
    if (!targetBatchId) {
      setError("Choose a draft batch first.");
      return;
    }
    const target = assignableSlots.find((slot) => slot.id === targetBatchId);
    const state = assignmentRowState(row, targetBatchId);
    const allowMove = state.kind === "other_batch" && state.can_move;
    if (allowMove && !window.confirm(`Move ${row.full_name} from ${row.assigned_batch_label} to ${target?.batch_name}?`)) {
      return;
    }
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-invitees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "allocate_batch",
        interview_slot_id: targetBatchId,
        invitee_ids: [row.id],
        allow_move: allowMove,
        confirm: true,
      }),
    });
    await load();
    setSaving(false);
    if (!ok) {
      setError(
        data.error === "insufficient_batch_capacity"
          ? `This batch only has ${data.available ?? 0} place(s) left.`
          : data.error || "Could not assign invitee"
      );
      return;
    }
    setSuccess(
      `${row.full_name} assigned to ${data.batch_name || target?.batch_name}. No invitations were sent.${
        target?.published ? " Publish or retry invitations to email this invitee." : ""
      }`
    );
  }

  async function removeInvitee(row) {
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-invitees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unallocate", invitee_ids: [row.id], confirm: true }),
    });
    await load();
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not remove invitee");
      return;
    }
    setSuccess(`${row.full_name} removed from the draft batch.`);
  }

  async function openWhatsApp(row) {
    const { ok, data } = await fetchJson("/api/director/interview-invitees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, action: "whatsapp_preview" }),
    });
    if (!ok) {
      setError(data.error || "Could not prepare WhatsApp message");
      return;
    }
    setWhatsappPreview({ ...data, name: row.full_name });
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div> : null}
      {unavailable ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Special invitee storage is not available until the pending interview_special_invitees migration is applied.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">University invitees</h2>
          <p className="mt-1 text-sm text-gray-500">
            Register international students recommended by universities. They share batch capacity with
            shortlisted applicants. Saving a record does not send email or WhatsApp. The portal does not send WhatsApp messages.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((open) => !open)}
          className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus size={16} /> Add invitee
        </button>
      </div>

      {showCreate ? (
        <form onSubmit={createInvitee} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="University">
              <input required value={form.university} onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Email address">
              <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="WhatsApp phone (with country code)">
              <input required value={form.whatsapp_phone} onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone: e.target.value }))} placeholder="+233246672876" className={inputClass} />
            </Field>
            <Field label="Nationality (optional)">
              <input value={form.nationality} onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Programme of study (optional)">
              <input value={form.programme_of_study} onChange={(e) => setForm((f) => ({ ...f, programme_of_study: e.target.value }))} className={inputClass} />
            </Field>
          </div>
          <button type="submit" disabled={saving} className="mt-4 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Save invitee
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invitees" className={`${inputClass} pl-9`} />
        </div>
        <Field label="Assign to draft batch">
          <select value={targetBatchId} onChange={(e) => setTargetBatchId(e.target.value)} className={inputClass}>
            <option value="">Select a draft batch</option>
            {assignableSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.published ? "Published · " : "Draft · "}
                {slot.batch_name} · {slot.booked || 0}/{slot.capacity || "?"}
                {slot.invitee_booked || slot.applicant_booked
                  ? ` (${slot.applicant_booked || 0} applicants · ${slot.invitee_booked || 0} invitees)`
                  : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
            No university invitees yet.
          </p>
        ) : (
          filtered.map((row) => {
            const state = assignmentRowState(row, targetBatchId);
            return (
              <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{row.full_name}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-royal">{UNIVERSITY_INVITEE_LABEL}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {row.university}
                      {row.programme_of_study ? ` · ${row.programme_of_study}` : ""}
                      {row.nationality ? ` · ${row.nationality}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">{row.email} · {row.whatsapp_phone}</p>
                    <p className="mt-2 text-xs font-medium text-gray-800">
                      {state.status_label}
                      {row.assigned_batch_label ? ` · ${row.assigned_batch_label}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {state.selectable || state.can_move ? (
                      <button type="button" disabled={saving || !targetBatchId} onClick={() => assignInvitee(row)} className="rounded-lg bg-royal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        {state.can_move ? "Move to selected batch" : "Assign to selected batch"}
                      </button>
                    ) : null}
                    {row.assigned_slot_id && !row.assigned_published ? (
                      <button type="button" disabled={saving} onClick={() => removeInvitee(row)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">
                        Remove
                      </button>
                    ) : null}
                    <button type="button" onClick={() => openWhatsApp(row)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs">
                      WhatsApp message
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {whatsappPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">WhatsApp message for {whatsappPreview.name}</h3>
            <p className="mt-2 text-sm text-amber-800">{whatsappPreview.note}</p>
            <textarea readOnly value={whatsappPreview.message} rows={12} className={`${inputClass} mt-4`} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setWhatsappPreview(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                Close
              </button>
              {whatsappPreview.waMe ? (
                <a href={whatsappPreview.waMe} target="_blank" rel="noreferrer" className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white">
                  Open in WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-xs font-medium text-gray-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
