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
  Circle,
  Lock,
  Plus,
  Search,
} from "lucide-react";
import { fetchJson } from "@/lib/read-response-json";
import {
  DIRECTOR_REGION_FILTERS,
  STUDY_LOCATION_UNCONFIRMED_LABEL,
  filterByDirectorLocationConfirmation,
  filterByDirectorStudyRegion,
} from "@/lib/director-location-filter";
import { GHANA_REGIONS } from "@/lib/ghana-regions";
import {
  assignmentRowState,
  summarizeAssignmentCounts,
} from "@/lib/director-interview-assignment";
import {
  UNIVERSITY_INVITEE_LABEL,
  applicantSelectionKey,
  inviteeSelectionKey,
  parseSelectionKeys,
  planCombinedBatchOccupancy,
  summarizeInviteeCounts,
} from "@/lib/director-interview-invitees";

function applicantLabel(app) {
  return app.applicant_name || app.full_name || app.profiles?.full_name || "Unknown";
}

function applicantEmail(app) {
  return app.email || app.profiles?.email || "—";
}

const emptyForm = {
  batch_name: "",
  interview_date: "",
  interview_time: "08:00",
  end_time: "09:00",
  location: "",
  meeting_link: "",
  congratulations_message: "",
  capacity: "10",
  interview_format: "in_person",
};

export default function DirectorPublishedInterviews({ mode = "manage", initialFilters = {} }) {
  const [queueUnscheduled, setQueueUnscheduled] = useState([]);
  const [readyToShortlist, setReadyToShortlist] = useState([]);
  const [applications, setApplications] = useState([]);
  const [invitees, setInvitees] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState(initialFilters.q || "");
  const [region, setRegion] = useState(initialFilters.region || "");
  const [loc, setLoc] = useState(initialFilters.loc || "");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [targetBatchId, setTargetBatchId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [locationForm, setLocationForm] = useState(null);
  const [inviteSettings, setInviteSettings] = useState({
    whatsapp_contact: "",
    physical_venue: "",
  });

  async function loadData() {
    setError(null);
    const { ok, data } = await fetchJson("/api/director/interview-slots");
    if (!ok) {
      setError(data.error || "Failed to load interview batches");
      return false;
    }
    setApplications(data.applications || []);
    setInvitees(data.invitees || []);
    setSlots(data.slots || []);
    setQueueUnscheduled(data.queue?.shortlisted || data.queue?.unscheduled || []);
    setReadyToShortlist(data.queue?.ready_to_shortlist || []);
    return true;
  }

  async function loadInviteSettings() {
    const { ok, data } = await fetchJson("/api/director/interview-schedules");
    if (!ok) return;
    setInviteSettings({
      whatsapp_contact: data.schedule?.whatsapp_contact || "",
      physical_venue: data.schedule?.physical_venue || "",
    });
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadData(), loadInviteSettings()]);
      setLoading(false);
    }
    load();
  }, []);

  const selectablePool = useMemo(() => {
    let applicants = queueUnscheduled.map((app) => ({
      ...app,
      location_confirmation: app.location_confirmation || null,
      source_kind: "applicant",
      selection_key: applicantSelectionKey(app.id),
    }));
    if (region) applicants = filterByDirectorStudyRegion(applicants, region);
    if (loc) applicants = filterByDirectorLocationConfirmation(applicants, loc);
    let inviteeRows = invitees.map((row) => ({
      ...row,
      source_kind: "invitee",
      selection_key: inviteeSelectionKey(row.id),
    }));
    if (assignmentFilter === "unassigned") {
      applicants = applicants.filter((app) => !app.assigned_slot_id);
      inviteeRows = inviteeRows.filter((row) => !row.assigned_slot_id);
    }
    if (assignmentFilter === "assigned") {
      applicants = applicants.filter((app) => app.assigned_slot_id);
      inviteeRows = inviteeRows.filter((row) => row.assigned_slot_id);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      applicants = applicants.filter((app) => {
        const hay = `${applicantLabel(app)} ${applicantEmail(app)} ${app.university || ""} ${app.study_region || ""} ${app.assigned_batch_name || ""}`.toLowerCase();
        return hay.includes(q);
      });
      inviteeRows = inviteeRows.filter((row) => {
        const hay = `${row.full_name || ""} ${row.email || ""} ${row.university || ""} ${row.assigned_batch_name || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return [...applicants, ...inviteeRows];
  }, [queueUnscheduled, invitees, region, loc, assignmentFilter, search]);

  const assignmentCounts = useMemo(
    () => summarizeAssignmentCounts(queueUnscheduled),
    [queueUnscheduled]
  );
  const inviteeCounts = useMemo(() => summarizeInviteeCounts(invitees), [invitees]);

  const draftSlots = useMemo(
    () => (slots || []).filter((s) => (s.status || "scheduled") === "scheduled" && !s.published),
    [slots]
  );
  const publishedSlots = useMemo(
    () => (slots || []).filter((s) => (s.status || "scheduled") === "scheduled" && s.published),
    [slots]
  );
  const completedSlots = useMemo(
    () => (slots || []).filter((s) => s.status === "completed"),
    [slots]
  );

  function findPoolRow(key) {
    return (
      selectablePool.find((row) => row.selection_key === key) ||
      invitees.find((row) => inviteeSelectionKey(row.id) === key) ||
      queueUnscheduled.find((row) => applicantSelectionKey(row.id) === key)
    );
  }

  function toggleSelect(key) {
    const row = findPoolRow(key);
    if (!assignmentRowState(row, targetBatchId).selectable) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveInviteSettings(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { ok, data } = await fetchJson("/api/director/interview-schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "schedule", ...inviteSettings }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not save invitation details");
      return;
    }
    setSuccess("Invitation details saved. Applicants were not emailed.");
  }

  async function createBatch(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { ok, data } = await fetchJson("/api/interview-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        capacity: Number(form.capacity) || 10,
        application_ids: [],
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not create batch");
      return;
    }
    setForm(emptyForm);
    setShowCreate(false);
    setTargetBatchId(data.slot_id || "");
    await loadData();
    setSuccess("Draft batch created. No invitations were sent.");
  }

  function assignmentErrorMessage(data) {
    if (data.error === "insufficient_batch_capacity") {
      return `This batch only has ${data.available ?? 0} place(s) left.`;
    }
    if (data.error === "already_assigned_other_batch") {
      const first = data.conflicts?.[0];
      return first?.assigned_batch_label
        ? `Some applicants are already assigned to ${first.assigned_batch_label}. Remove or move them first.`
        : "Some people are already assigned to another batch.";
    }
    if (data.error === "already_on_published_batch" || data.error === "published_locked") {
      return "Published assignments cannot be moved here. Use Applicant Responses to reschedule.";
    }
    return data.error || "Could not assign people to this batch";
  }

  async function assignSelected() {
    const slotId = targetBatchId;
    if (!slotId) {
      setError("Choose a draft batch first.");
      return;
    }
    const target = draftSlots.find((slot) => slot.id === slotId);
    const assignableKeys = Array.from(selectedIds).filter((key) => {
      const row = findPoolRow(key) || selectablePool.find((item) => item.selection_key === key);
      return assignmentRowState(row, slotId).selectable;
    });
    const parsed = parseSelectionKeys(assignableKeys);
    if (!parsed.application_ids.length && !parsed.invitee_ids.length) {
      setError("Select at least one unassigned applicant or university invitee.");
      return;
    }
    const occupancy = planCombinedBatchOccupancy({
      slot: target,
      bookedApplicants: target?.applicant_booked || 0,
      bookedInvitees: target?.invitee_booked || 0,
      selectedApplicantIds: parsed.application_ids,
      selectedInviteeIds: parsed.invitee_ids,
    });
    if (!occupancy.ok) {
      setError(assignmentErrorMessage(occupancy));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    let applicantCount = 0;
    let inviteeCount = 0;
    if (parsed.application_ids.length) {
      const { ok, data } = await fetchJson("/api/director/interview-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "allocate_batch",
          interview_slot_id: slotId,
          application_ids: parsed.application_ids,
          interview_format: target?.meeting_link ? "virtual" : "in_person",
          confirm: true,
        }),
      });
      if (!ok) {
        await loadData();
        setSaving(false);
        setError(assignmentErrorMessage(data));
        return;
      }
      applicantCount = data.updated || 0;
    }
    if (parsed.invitee_ids.length) {
      const { ok, data } = await fetchJson("/api/director/interview-invitees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "allocate_batch",
          interview_slot_id: slotId,
          invitee_ids: parsed.invitee_ids,
          interview_format: target?.meeting_link ? "virtual" : "in_person",
          confirm: true,
        }),
      });
      if (!ok) {
        await loadData();
        setSaving(false);
        setError(assignmentErrorMessage(data));
        return;
      }
      inviteeCount = data.updated || 0;
    }
    await loadData();
    setSaving(false);
    const count = applicantCount + inviteeCount;
    if (!count) {
      setError("No people were assigned. Refresh and try again.");
      return;
    }
    setSelectedIds(new Set());
    const batchName = target?.batch_name || "the selected batch";
    setSuccess(
      `${count} ${count === 1 ? "person" : "people"} assigned to ${batchName} (${applicantCount} applicant${
        applicantCount === 1 ? "" : "s"
      } · ${inviteeCount} invitee${inviteeCount === 1 ? "" : "s"}). No invitations were sent.`
    );
  }

  async function moveApplicant(app) {
    const slotId = targetBatchId;
    const target = draftSlots.find((slot) => slot.id === slotId);
    if (!slotId || !target) {
      setError("Choose a draft batch first.");
      return;
    }
    const fromLabel = app.assigned_batch_label || app.assigned_batch_name || "the current batch";
    const toLabel = [target.batch_name, target.interview_date, target.interview_time]
      .filter(Boolean)
      .join(" · ");
    const name = applicantLabel(app);
    if (
      !window.confirm(
        `Move ${name} from ${fromLabel} to ${toLabel}? This does not send an invitation.`
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const endpoint =
      app.source_kind === "invitee" ? "/api/director/interview-invitees" : "/api/director/interview-allocations";
    const payload =
      app.source_kind === "invitee"
        ? {
            action: "allocate_batch",
            interview_slot_id: slotId,
            invitee_ids: [app.id],
            interview_format: target.meeting_link ? "virtual" : "in_person",
            allow_move: true,
            confirm: true,
          }
        : {
            action: "allocate_batch",
            interview_slot_id: slotId,
            application_ids: [app.id],
            interview_format: target.meeting_link ? "virtual" : "in_person",
            allow_move: true,
            confirm: true,
          };
    const { ok, data } = await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadData();
    setSaving(false);
    if (!ok) {
      setError(assignmentErrorMessage(data));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(app.selection_key || applicantSelectionKey(app.id));
      next.delete(inviteeSelectionKey(app.id));
      return next;
    });
    setSuccess(`${name} moved from ${fromLabel} to ${toLabel}.`);
  }

  async function removeApplicant(applicationId, sourceKind = "applicant") {
    setSaving(true);
    setError(null);
    const endpoint =
      sourceKind === "invitee" ? "/api/director/interview-invitees" : "/api/director/interview-allocations";
    const payload =
      sourceKind === "invitee"
        ? { action: "unallocate", invitee_ids: [applicationId], confirm: true }
        : { action: "unallocate", application_ids: [applicationId], confirm: true };
    const { ok, data } = await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadData();
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not remove from the draft batch");
      return;
    }
    setSuccess(
      sourceKind === "invitee"
        ? "University invitee removed from the draft batch."
        : "Applicant removed from the draft batch."
    );
  }

  async function publishBatch(slotId) {
    if (
      !window.confirm(
        "Publish this batch and email assigned applicants and university invitees? Draft edits after this will not unsend invitations. Already-sent invitations are not resent."
      )
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { ok: previewOk, data: preview } = await fetchJson("/api/interview-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish: true, slot_id: slotId, confirm: false }),
    });
    if (!previewOk) {
      setError(preview.error || "Could not prepare invitations");
      setSaving(false);
      return;
    }
    const blockedCount =
      (preview.preview?.blocked_count || 0) + (preview.preview?.invitees?.blocked_count || 0);
    if (blockedCount) {
      setError(
        `Cannot publish yet: ${blockedCount} person(s) are missing venue, meeting link, or email.`
      );
      setSaving(false);
      return;
    }
    const { ok, data } = await fetchJson("/api/interview-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish: true, slot_id: slotId, confirm: true }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Failed to publish batch");
      return;
    }
    await loadData();
    setSuccess(
      data.partial
        ? `Partial send: ${data.notified || 0} sent, ${data.failed_count || 0} failed. Publish again to retry.`
        : `Published. ${data.notified || 0} invitation(s) sent.`
    );
  }

  async function cancelBatch(slotId) {
    if (!window.confirm("Cancel this batch? Assigned applicants return to the unscheduled list.")) return;
    setSaving(true);
    const { ok, data } = await fetchJson(`/api/director/interview-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Failed to cancel batch");
      return;
    }
    await loadData();
    setSuccess("Batch cancelled.");
  }

  async function completeBatch(slotId) {
    if (!window.confirm("Mark this batch complete? Assigned applicants move to final programme review.")) return;
    setSaving(true);
    const { ok, data } = await fetchJson(`/api/director/interview-slots/${slotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Failed to mark complete");
      return;
    }
    await loadData();
    setSuccess(`Batch completed. ${data.applicants_advanced || 0} applicant(s) moved to final review.`);
  }

  async function deleteBatch(slotId) {
    if (!window.confirm("Delete this empty batch?")) return;
    setSaving(true);
    const { ok, data } = await fetchJson(`/api/director/interview-slots/${slotId}`, { method: "DELETE" });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Failed to delete batch");
      return;
    }
    await loadData();
    setSuccess("Empty batch deleted.");
  }

  async function saveLocationConfirmation() {
    if (!locationForm) return;
    setSaving(true);
    const { ok, data } = await fetchJson("/api/director/interview-location-confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        application_id: locationForm.id,
        confirmed_region: locationForm.confirmed_region,
        confirmed_town: locationForm.confirmed_town,
        study_institution: locationForm.study_institution,
        study_region: locationForm.confirmed_region,
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not confirm study location");
      return;
    }
    setLocationForm(null);
    await loadData();
    setSuccess("Study location confirmed.");
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{success}</div>
      ) : null}

      {mode === "manage" ? (
        <>
          <p className="text-sm text-gray-500">
            For this exercise: 17–19 November 2026, 8:00 AM–4:00 PM, with a 12:00–12:30 break.
            About 10 applicants per hour and one interview panel. These are guidelines — create
            each batch yourself. Applicants cannot self-book.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">Draft batches</h2>
            <button
              type="button"
              onClick={() => setShowCreate((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} /> Create Batch
            </button>
          </div>

          {showCreate ? (
            <form onSubmit={createBatch} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-bold text-gray-900">New interview batch</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Batch name">
                  <input
                    required
                    value={form.batch_name}
                    onChange={(e) => setForm((f) => ({ ...f, batch_name: e.target.value }))}
                    placeholder="e.g. Batch 1"
                    className={inputClass}
                  />
                </Field>
                <Field label="Interview date">
                  <input
                    required
                    type="date"
                    value={form.interview_date}
                    onChange={(e) => setForm((f) => ({ ...f, interview_date: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Start time">
                  <input
                    required
                    type="time"
                    value={form.interview_time}
                    onChange={(e) => setForm((f) => ({ ...f, interview_time: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="End time">
                  <input
                    required
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Venue or virtual meeting details">
                  <input
                    required
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Venue, or note that this batch is virtual"
                    className={inputClass}
                  />
                </Field>
                <Field label="Maximum people (applicants + invitees)">
                  <input
                    required
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Interview format">
                  <select
                    value={form.interview_format}
                    onChange={(e) => setForm((f) => ({ ...f, interview_format: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="in_person">In person</option>
                    <option value="virtual">Virtual</option>
                  </select>
                </Field>
                <Field label="Meeting link (virtual batches)">
                  <input
                    type="url"
                    value={form.meeting_link}
                    onChange={(e) => setForm((f) => ({ ...f, meeting_link: e.target.value }))}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Message included in the invitation (optional)">
                <textarea
                  value={form.congratulations_message}
                  onChange={(e) => setForm((f) => ({ ...f, congratulations_message: e.target.value }))}
                  rows={2}
                  className={`${inputClass} mt-1`}
                />
              </Field>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save draft batch"}
              </button>
            </form>
          ) : null}

          <form
            onSubmit={saveInviteSettings}
            className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <h3 className="font-bold text-gray-900">Invitation details</h3>
            <p className="mt-1 text-sm text-gray-500">
              Used when you publish. Saving these fields does not email applicants.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Official WhatsApp contact">
                <input
                  value={inviteSettings.whatsapp_contact}
                  onChange={(e) =>
                    setInviteSettings((s) => ({ ...s, whatsapp_contact: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Default venue (if a batch has no venue)">
                <input
                  value={inviteSettings.physical_venue}
                  onChange={(e) =>
                    setInviteSettings((s) => ({ ...s, physical_venue: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              Save invitation details
            </button>
          </form>

          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-bold text-gray-900">
                  <Users size={18} /> Shortlisted applicants and university invitees
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {assignmentCounts.total} applicants · {assignmentCounts.assigned} assigned ·{" "}
                  {assignmentCounts.unassigned} not assigned. {inviteeCounts.total} university invitees ·{" "}
                  {inviteeCounts.assigned} assigned · {inviteeCounts.unassigned} not assigned.{" "}
                  {selectedIds.size} selected.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                {DIRECTOR_REGION_FILTERS.map((item) => (
                  <option key={item.key || "all"} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select value={loc} onChange={(e) => setLoc(e.target.value)} className={inputClass}>
                <option value="">All study locations</option>
                <option value="confirmed">Study location confirmed</option>
                <option value="unconfirmed">{STUDY_LOCATION_UNCONFIRMED_LABEL}</option>
              </select>
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Applicants</option>
                <option value="unassigned">Not Assigned</option>
                <option value="assigned">Assigned</option>
              </select>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <Field label="Assign to draft batch">
                <select
                  value={targetBatchId}
                  onChange={(e) => setTargetBatchId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a draft batch</option>
                  {draftSlots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.batch_name} · {slot.interview_date} {slot.interview_time}
                      {slot.capacity
                        ? ` · ${slot.booked || 0}/${slot.capacity} (${slot.applicant_booked || 0} applicants · ${slot.invitee_booked || 0} invitees)`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                disabled={saving || selectedIds.size === 0 || !targetBatchId}
                onClick={assignSelected}
                className="rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Assign selected ({selectedIds.size})
              </button>
            </div>
            {selectablePool.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                No shortlisted applicants or university invitees waiting for a batch.
                {readyToShortlist.length
                  ? ` ${readyToShortlist.length} Stage 2 approved applicant(s) still need to be shortlisted from their application.`
                  : ""}
              </p>
            ) : (
              <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
                {selectablePool.map((app) => {
                  const row = assignmentRowState(app, targetBatchId);
                  const rowClass =
                    row.kind === "this_batch"
                      ? "border-green-200 bg-green-50"
                      : row.kind === "other_batch"
                        ? "border-slate-200 bg-slate-50"
                        : "border-gray-100 bg-white hover:bg-gray-50";
                  return (
                    <label
                      key={app.selection_key || app.id}
                      className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 ${rowClass} ${
                        row.selectable ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(app.selection_key)}
                        disabled={!row.selectable}
                        onChange={() => toggleSelect(app.selection_key)}
                        className="mt-1"
                        title={row.reason || undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-gray-900">{applicantLabel(app)}</p>
                          {app.source_kind === "invitee" ? (
                            <span className="text-xs font-medium uppercase tracking-wide text-royal">
                              {UNIVERSITY_INVITEE_LABEL}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-xs font-medium text-royal"
                              onClick={(e) => {
                                e.preventDefault();
                                setLocationForm({
                                  id: app.id,
                                  name: applicantLabel(app),
                                  assigned_batch_label: app.assigned_batch_label,
                                  assignment_status_label: row.status_label,
                                  confirmed_region: app.location_confirmed ? app.study_region || "" : "",
                                  confirmed_town: app.location_confirmed ? app.study_town || "" : "",
                                  study_institution: app.location_confirmed
                                    ? app.study_institution || ""
                                    : app.university || "",
                                });
                              }}
                            >
                              Confirm study location
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {applicantEmail(app)} · {app.university || "No university"}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-medium text-gray-800">
                          {row.kind === "this_batch" ? (
                            <CheckCircle2 size={14} className="text-green-700" aria-hidden="true" />
                          ) : row.kind === "other_batch" ? (
                            <Lock size={14} className="text-slate-600" aria-hidden="true" />
                          ) : (
                            <Circle size={14} className="text-gray-400" aria-hidden="true" />
                          )}
                          <span>{row.status_label}</span>
                          {app.assigned_batch_label ? (
                            <span className="font-normal text-gray-600">
                              · {app.assigned_batch_label}
                            </span>
                          ) : null}
                        </p>
                        {row.reason && !row.selectable ? (
                          <p className="mt-1 text-xs text-gray-500">{row.reason}</p>
                        ) : null}
                        {app.source_kind === "invitee" ? (
                          <p className="mt-1 text-xs text-gray-600">
                            {app.programme_of_study || "Programme not recorded"}
                            {app.nationality ? ` · ${app.nationality}` : ""}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-600">
                            Study location: {app.study_region || STUDY_LOCATION_UNCONFIRMED_LABEL}
                            {app.location_confirmed ? ` · ${app.study_town} · ${app.study_institution}` : ""}
                          </p>
                        )}
                        {row.can_move ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={(e) => {
                              e.preventDefault();
                              moveApplicant(app);
                            }}
                            className="mt-2 text-xs font-semibold text-royal disabled:opacity-50"
                          >
                            Move to selected batch
                          </button>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <BatchList
            title="Draft batches"
            slots={draftSlots}
            applications={applications}
            saving={saving}
            onPublish={publishBatch}
            onCancel={cancelBatch}
            onDelete={deleteBatch}
            onRemove={removeApplicant}
            invitees={invitees}
            empty="No draft batches yet. Create a batch, then assign applicants and university invitees."
          />
        </>
      ) : (
        <>
          <BatchList
            title="Published invitations"
            slots={publishedSlots}
            applications={applications}
            invitees={invitees}
            saving={saving}
            onPublish={publishBatch}
            onComplete={completeBatch}
            onCancel={cancelBatch}
            empty="No published interview batches."
          />
          <BatchList
            title="Completed interviews"
            slots={completedSlots}
            applications={applications}
            invitees={invitees}
            saving={saving}
            empty="No completed interview batches yet."
          />
        </>
      )}

      {locationForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Study location</h3>
            <p className="mt-1 text-sm text-gray-600">{locationForm.name}</p>
            {locationForm.assignment_status_label ? (
              <p className="mt-1 text-xs font-medium text-gray-700">
                {locationForm.assignment_status_label}
                {locationForm.assigned_batch_label ? ` · ${locationForm.assigned_batch_label}` : ""}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              Confirm the region, town/city, and institution where the applicant currently studies.
              Do not use hometown or residential address.
            </p>
            <label className="mt-4 block text-xs font-medium text-gray-500">
              Region of study
              <select
                value={locationForm.confirmed_region}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, confirmed_region: e.target.value }))
                }
                className={`${inputClass} mt-1`}
              >
                <option value="">Select region</option>
                {GHANA_REGIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-gray-500">
              Town/city of study
              <input
                value={locationForm.confirmed_town}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, confirmed_town: e.target.value }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-gray-500">
              Institution
              <input
                value={locationForm.study_institution}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, study_institution: e.target.value }))
                }
                className={`${inputClass} mt-1`}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLocationForm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveLocationConfirmation}
                className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

function Field({ label, children }) {
  return (
    <label className="block text-xs font-medium text-gray-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function BatchList({
  title,
  slots,
  applications,
  invitees = [],
  saving,
  onPublish,
  onComplete,
  onCancel,
  onDelete,
  onRemove,
  empty,
}) {
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
            const assignedIds = new Set(slot.assigned_ids || []);
            const assignedInviteeIds = new Set(slot.assigned_invitee_ids || []);
            const assignedApps = applications.filter(
              (a) =>
                a.assigned_slot_id === slot.id ||
                a.interview_slot_id === slot.id ||
                assignedIds.has(a.id)
            );
            const assignedInvitees = invitees.filter(
              (row) =>
                row.assigned_slot_id === slot.id ||
                row.interview_slot_id === slot.id ||
                assignedInviteeIds.has(row.id)
            );
            const occupantCount = assignedApps.length + assignedInvitees.length;
            const status = slot.status || "scheduled";
            const draft = !slot.published;
            const statusTone = draft ? "bg-amber-50 text-amber-800" : "bg-indigo-50 text-indigo-700";
            return (
              <div key={slot.id} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900">{slot.batch_name}</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {slot.interview_date} · {slot.interview_time}
                        {slot.end_time ? `–${slot.end_time}` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {slot.location}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
                      {status === "scheduled" ? (draft ? "Draft" : "Published") : status}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                      <Users size={12} />
                      {slot.booked ?? occupantCount}
                      {slot.capacity ? ` / ${slot.capacity}` : ""}
                    </span>
                    <span className="rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-600">
                      {slot.applicant_booked ?? assignedApps.length} applicants ·{" "}
                      {slot.invitee_booked ?? assignedInvitees.length} invitees
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {assignedApps.map((app) => (
                    <span
                      key={app.id}
                      className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs text-green-800"
                    >
                      <CheckCircle2 size={12} className="text-green-700" />
                      <Link href={`/director/applications/${app.id}`} className="hover:text-royal">
                        {applicantLabel(app)}
                      </Link>
                      <span className="text-green-700">
                        Assigned to This Batch
                        {app.assigned_batch_label ? ` · ${app.assigned_batch_label}` : ""}
                      </span>
                      {draft && onRemove ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onRemove(app.id, "applicant")}
                          className="ml-1 text-gray-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {assignedInvitees.map((row) => (
                    <span
                      key={`invitee-${row.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-800"
                    >
                      <CheckCircle2 size={12} className="text-indigo-700" />
                      <span>{row.full_name}</span>
                      <span className="uppercase tracking-wide">{UNIVERSITY_INVITEE_LABEL}</span>
                      <span>
                        Assigned to This Batch
                        {row.assigned_batch_label ? ` · ${row.assigned_batch_label}` : ""}
                      </span>
                      {draft && onRemove ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onRemove(row.id, "invitee")}
                          className="ml-1 text-gray-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {occupantCount === 0 ? (
                    <span className="text-xs text-gray-400">No people assigned yet</span>
                  ) : null}
                </div>
                {!draft && slot.invitation_delivery ? (
                  <p className="mt-3 text-xs text-gray-500">
                    Invitations: {slot.invitation_delivery.sent || 0} sent
                    {slot.invitation_delivery.failed
                      ? `, ${slot.invitation_delivery.failed} failed`
                      : ""}
                    {slot.invitation_delivery.pending
                      ? `, ${slot.invitation_delivery.pending} pending`
                      : ""}
                  </p>
                ) : null}
                {status === "scheduled" ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-50 pt-4">
                    {(draft || slot.invitation_delivery?.failed > 0) && onPublish ? (
                      <button
                        type="button"
                        disabled={saving || occupantCount === 0}
                        onClick={() => onPublish(slot.id)}
                        className="rounded-lg bg-royal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {draft ? "Publish and send invitations" : "Retry failed invitations"}
                      </button>
                    ) : null}
                    {onComplete ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onComplete(slot.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50"
                      >
                        Mark completed
                      </button>
                    ) : null}
                    {onCancel ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onCancel(slot.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                      >
                        Cancel batch
                      </button>
                    ) : null}
                    {occupantCount === 0 && onDelete ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onDelete(slot.id)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 disabled:opacity-50"
                      >
                        Delete empty batch
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
