"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { GHANA_REGIONS } from "@/lib/ghana-regions";
import { fetchJson } from "@/lib/read-response-json";

const emptyForm = { interview_date: "", start_time: "08:00", end_time: "16:00" };

export default function DirectorInterviewScheduleClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [schedule, setSchedule] = useState(null);
  const [days, setDays] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [settings, setSettings] = useState({
    appointment_duration_minutes: 6,
    arrival_minutes: 15,
    physical_venue: "",
    whatsapp_contact: "",
    physical_instructions: "",
    virtual_instructions: "",
    required_documents_physical: "",
    required_documents_virtual: "",
    virtual_eligible_study_regions: [],
  });

  const load = useCallback(async () => {
    const { ok, data } = await fetchJson("/api/director/interview-schedules");
    if (!ok) {
      setError(data.error || "Failed to load interview schedule");
      return false;
    }
    setSchedule(data.schedule || null);
    setDays(data.days || []);
    setSettings({
      appointment_duration_minutes: data.schedule?.appointment_duration_minutes || 6,
      arrival_minutes: data.schedule?.arrival_minutes || 15,
      physical_venue: data.schedule?.physical_venue || "",
      whatsapp_contact: data.schedule?.whatsapp_contact || "",
      physical_instructions: data.schedule?.physical_instructions || "",
      virtual_instructions: data.schedule?.virtual_instructions || "",
      required_documents_physical: data.schedule?.required_documents_physical || "",
      required_documents_virtual: data.schedule?.required_documents_virtual || "",
      virtual_eligible_study_regions: Array.isArray(data.schedule?.virtual_eligible_study_regions)
        ? data.schedule.virtual_eligible_study_regions
        : [],
    });
    setError("");
    return true;
  }, []);

  useEffect(() => {
    async function run() {
      setLoading(true);
      await load();
      setLoading(false);
    }
    run();
  }, [load]);

  async function saveDay(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const payload = editingId ? { id: editingId, ...form } : form;
    const { ok, data } = await fetchJson("/api/director/interview-schedules", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not save interview date");
      return;
    }
    setForm(emptyForm);
    setEditingId("");
    setSuccess(editingId ? "Interview date updated." : "Interview date added.");
    await load();
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "schedule", ...settings }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not save schedule settings");
      return;
    }
    setSuccess("Schedule settings saved. Applicants were not notified.");
    await load();
  }

  async function saveBreaks(day, start, end) {
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "breaks",
        day_id: day.id,
        breaks: start && end ? [{ start_time: start, end_time: end }] : [],
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not save break");
      return;
    }
    setSuccess("Break updated.");
    await load();
  }

  async function generate(day) {
    setSaving(true);
    setError("");
    const { ok: previewOk, data: preview } = await fetchJson("/api/director/interview-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_id: day.id, confirm: false }),
    });
    if (!previewOk) {
      setSaving(false);
      setError(preview.error || "Could not preview batches");
      return;
    }
    if (
      !window.confirm(
        `Generate ${preview.preview?.batches || 0} hourly batches (${preview.preview?.capacity || 0} places) for ${day.label}? Unused empty drafts can be replaced; assigned or published batches are kept. Applicants are not emailed.`
      )
    ) {
      setSaving(false);
      return;
    }
    const { ok, data } = await fetchJson("/api/director/interview-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_id: day.id, confirm: true }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not generate batches");
      return;
    }
    setSuccess(`Generated ${data.capacity} interview places as hourly batches. Applicants were not notified.`);
    await load();
  }

  async function toggleActive(day) {
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-schedules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: day.id, is_active: !day.is_active }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not update date");
      return;
    }
    await load();
  }

  async function removeDay(day) {
    if (day.allocation_count > 0) {
      setError("Reassign or unallocate applicants before deleting this date.");
      return;
    }
    if (!window.confirm(`Delete ${day.label || day.interview_date}?`)) return;
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson(`/api/director/interview-schedules?dayId=${encodeURIComponent(day.id)}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not delete date");
      return;
    }
    setSuccess("Interview date removed.");
    await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Configure interview dates, duration, and breaks for {schedule?.class_name || "the current Class"}.
        Times are {schedule?.timezone || "Africa/Accra"} (GMT). One panel means appointments cannot overlap.
        Generating appointments does not email applicants.
      </p>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      ) : null}

      <form onSubmit={saveSettings} className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">Schedule settings</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-gray-500">
            Duration (minutes)
            <input
              type="number"
              min="1"
              max="180"
              value={settings.appointment_duration_minutes}
              onChange={(e) =>
                setSettings((s) => ({ ...s, appointment_duration_minutes: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Arrive/ready (minutes)
            <input
              type="number"
              min="0"
              max="120"
              value={settings.arrival_minutes}
              onChange={(e) => setSettings((s) => ({ ...s, arrival_minutes: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Physical venue
            <input
              value={settings.physical_venue}
              onChange={(e) => setSettings((s) => ({ ...s, physical_venue: e.target.value }))}
              placeholder="Set before publishing"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Official WhatsApp contact
            <input
              value={settings.whatsapp_contact}
              onChange={(e) => setSettings((s) => ({ ...s, whatsapp_contact: e.target.value }))}
              placeholder="Set before publishing"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-500">
            Physical arrival instructions
            <textarea
              value={settings.physical_instructions}
              onChange={(e) => setSettings((s) => ({ ...s, physical_instructions: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={3}
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Virtual readiness instructions
            <textarea
              value={settings.virtual_instructions}
              onChange={(e) => setSettings((s) => ({ ...s, virtual_instructions: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={3}
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Physical document instructions
            <textarea
              value={settings.required_documents_physical}
              onChange={(e) =>
                setSettings((s) => ({ ...s, required_documents_physical: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={3}
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Virtual document instructions
            <textarea
              value={settings.required_documents_virtual}
              onChange={(e) =>
                setSettings((s) => ({ ...s, required_documents_virtual: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              rows={3}
            />
          </label>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500">Virtual request study regions</p>
          <p className="mt-1 text-[11px] text-gray-400">
            Leave empty until the recruitment team confirms which northern study regions may request a
            virtual interview. Selecting a region does not auto-approve requests.
          </p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {GHANA_REGIONS.map((name) => {
              const checked = settings.virtual_eligible_study_regions.includes(name);
              return (
                <label key={name} className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSettings((s) => ({
                        ...s,
                        virtual_eligible_study_regions: checked
                          ? s.virtual_eligible_study_regions.filter((region) => region !== name)
                          : [...s.virtual_eligible_study_regions, name],
                      }))
                    }
                  />
                  {name}
                </label>
              );
            })}
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save settings
        </button>
      </form>

      <form onSubmit={saveDay} className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Plus size={16} /> {editingId ? "Edit interview date" : "Add interview date"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-gray-500">
            Date
            <input
              type="date"
              required
              value={form.interview_date}
              onChange={(e) => setForm((f) => ({ ...f, interview_date: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            Start
            <input
              type="time"
              required
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-gray-500">
            End
            <input
              type="time"
              required
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {editingId ? "Save date" : "Add date"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId("");
                setForm(emptyForm);
              }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Window / break</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Allocated</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No dates yet.
                </td>
              </tr>
            ) : (
              days.map((day) => {
                const br = day.breaks?.[0] || { start_time: "12:00", end_time: "12:30" };
                return (
                  <tr key={day.id} className="border-t border-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{day.label}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {day.window_label}
                      <form
                        className="mt-2 flex gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const data = new FormData(e.currentTarget);
                          saveBreaks(day, data.get("start"), data.get("end"));
                        }}
                      >
                        <input
                          name="start"
                          type="time"
                          defaultValue={br.start_time}
                          className="rounded border border-gray-200 px-1 py-1 text-xs"
                        />
                        <input
                          name="end"
                          type="time"
                          defaultValue={br.end_time}
                          className="rounded border border-gray-200 px-1 py-1 text-xs"
                        />
                        <button type="submit" className="text-xs font-medium text-royal">
                          Save break
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{day.capacity ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{day.allocation_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          day.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {day.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-royal hover:underline"
                          onClick={() => generate(day)}
                        >
                          Generate hourly batches
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-royal hover:underline"
                          onClick={() => {
                            setEditingId(day.id);
                            setForm({
                              interview_date: day.interview_date,
                              start_time: day.start_time,
                              end_time: day.end_time,
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-gray-600 hover:underline"
                          onClick={() => toggleActive(day)}
                        >
                          {day.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-700 hover:underline"
                          onClick={() => removeDay(day)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
