"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Search, Users } from "lucide-react";
import {
  INTERVIEW_ALLOCATION_BADGE,
  INTERVIEW_ALLOCATION_FILTERS,
} from "@/lib/director-interview-allocation";
import {
  DIRECTOR_REGION_FILTERS,
  DIRECTOR_TOWN_FILTERS,
  STUDY_LOCATION_UNCONFIRMED_LABEL,
} from "@/lib/director-location-filter";
import { INTERVIEW_LOCATION_FILTERS } from "@/lib/director-interview-location";
import { DIRECTOR_STAGE2_REVIEW_FILTERS } from "@/lib/director-stage2-review";
import { GHANA_REGIONS } from "@/lib/ghana-regions";
import {
  interviewModeLabel,
  interviewResponseLabel,
} from "@/lib/interview-applicant-response";
import DirectorInterviewRequestsPanel from "@/components/director/DirectorInterviewRequestsPanel";
import { fetchJson } from "@/lib/read-response-json";

function buildHref(filters) {
  const params = new URLSearchParams();
  params.set("tab", "allocation");
  if (filters.region) params.set("region", filters.region);
  if (filters.town) params.set("town", filters.town);
  if (filters.alloc) params.set("alloc", filters.alloc);
  if (filters.idate) params.set("idate", filters.idate);
  if (filters.stage2) params.set("stage2", filters.stage2);
  if (filters.loc) params.set("loc", filters.loc);
  if (filters.institution) params.set("institution", filters.institution);
  if (filters.q) params.set("q", filters.q);
  return `/director/interviews?${params.toString()}`;
}

export default function DirectorInterviewAllocationClient({
  initialFilters = {},
  embedded = false,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [counts, setCounts] = useState(null);
  const [days, setDays] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState(initialFilters.q || "");
  const [region, setRegion] = useState(initialFilters.region || "");
  const [town, setTown] = useState(initialFilters.town || "");
  const [alloc, setAlloc] = useState(initialFilters.alloc || "");
  const [idate, setIdate] = useState(initialFilters.idate || "");
  const [stage2, setStage2] = useState(initialFilters.stage2 || "");
  const [loc, setLoc] = useState(initialFilters.loc || "");
  const [institution, setInstitution] = useState(initialFilters.institution || "");
  const [townOptions, setTownOptions] = useState(DIRECTOR_TOWN_FILTERS);
  const [institutionOptions, setInstitutionOptions] = useState([{ key: "", label: "All institutions" }]);
  const [locationForm, setLocationForm] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");

  const filters = useMemo(
    () => ({ region, town, alloc, idate, stage2, loc, institution, q: search.trim() }),
    [region, town, alloc, idate, stage2, loc, institution, search]
  );

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const { ok, data } = await fetchJson(`/api/director/interview-allocations?${params.toString()}`);
    if (!ok) {
      setError(data.error || "Failed to load interview allocations");
      setApplicants([]);
      setCounts(null);
      setDays([]);
      return false;
    }
    setApplicants(data.applicants || []);
    setCounts(data.counts || null);
    setDays(data.days || []);
    setBatches(data.batches || []);
    setTownOptions(data.town_options?.length ? data.town_options : DIRECTOR_TOWN_FILTERS);
    setInstitutionOptions(
      data.institution_options?.length ? data.institution_options : [{ key: "", label: "All institutions" }]
    );
    if (data.load_error) setError(data.load_error);
    return true;
  }, [filters]);

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

  useEffect(() => {
    const href = buildHref(filters);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === href) return;
    const timer = setTimeout(() => router.replace(href, { scroll: false }), 200);
    return () => clearTimeout(timer);
  }, [filters, router]);

  const visibleIds = useMemo(() => applicants.map((row) => row.id), [applicants]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const activeDays = days.filter((d) => d.is_active !== false);
  const draftBatches = (batches || []).filter((batch) => !batch.published);

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function requestPreview(action, scheduleDayId = null, extras = {}) {
    setError("");
    setSuccess("");
    const application_ids = [...selected].filter((id) => visibleIds.includes(id));
    if (application_ids.length === 0) {
      setError("Select at least one applicant in the current list.");
      return;
    }
    setSaving(true);
    const { ok, data } = await fetchJson("/api/director/interview-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        schedule_day_id: scheduleDayId,
        interview_slot_id: extras.interview_slot_id,
        application_ids,
        confirm: false,
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not prepare allocation");
      return;
    }
    setConfirm({
      action,
      scheduleDayId,
      interview_slot_id: extras.interview_slot_id || null,
      application_ids,
      preview: data.preview,
      skipped: data.skipped || [],
    });
  }

  async function confirmChange() {
    if (!confirm) return;
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: confirm.action,
        schedule_day_id: confirm.scheduleDayId,
        interview_slot_id: confirm.interview_slot_id,
        application_ids: confirm.application_ids,
        confirm: true,
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Allocation failed");
      return;
    }
    setSuccess(
      `Updated ${data.updated || 0} applicant${data.updated === 1 ? "" : "s"}. Applicants were not notified.`
    );
    setConfirm(null);
    clearSelection();
    await load();
  }

  function openLocationForm(row) {
    setLocationForm({
      id: row.id,
      name: row.full_name,
      confirmed_region: row.location_confirmed ? row.confirmed_region || row.study_region || "" : "",
      confirmed_town: row.location_confirmed ? row.confirmed_town || "" : "",
      study_institution: row.location_confirmed
        ? row.study_institution_key && row.study_institution_key !== "unknown"
          ? row.study_institution
          : row.study_institution_prefill || ""
        : row.study_institution_prefill || row.university || "",
      alreadyConfirmed: Boolean(row.location_confirmed),
    });
  }

  async function saveLocationConfirmation() {
    if (!locationForm) return;
    setSaving(true);
    setError("");
    setSuccess("");
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
      setError(data.error || "Could not confirm location");
      return;
    }
    setSuccess("Location confirmed. Applicants were not notified. Stage 2 status did not change.");
    setLocationForm(null);
    await load();
  }

  async function clearLocationConfirmation() {
    if (!locationForm) return;
    setSaving(true);
    setError("");
    const { ok, data } = await fetchJson("/api/director/interview-location-confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unconfirm",
        application_id: locationForm.id,
      }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "Could not clear location confirmation");
      return;
    }
    setSuccess("Location confirmation cleared.");
    setLocationForm(null);
    await load();
  }

  const stage2Options = [
    { key: "", label: "All shortlisted" },
    ...DIRECTOR_STAGE2_REVIEW_FILTERS.filter((f) => f.key === "approved").map((f) => ({
      key: "approved",
      label: f.label,
    })),
    { key: "queue", label: "Interview queue" },
  ];

  return (
    <div className="min-w-0">
      {embedded ? null : (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Applicant allocation</h1>
        </div>
      )}
      <p className="mb-4 text-sm text-gray-500">
        Assign shortlisted applicants to unpublished interview batches. Draft assignments stay
        private until you publish a batch on Published Interviews. Applicants cannot self-book. Confirm region of study,
        town/city of study, and current institution here. Hometown and residential region are never used.
      </p>

      <DirectorInterviewRequestsPanel days={days} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-medium text-gray-500">
          Region of Study
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            {DIRECTOR_REGION_FILTERS.map(({ key, label }) => (
              <option key={key || "all-regions"} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Town/City of Study
          <select
            value={town}
            onChange={(e) => setTown(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            {townOptions.map(({ key, label }) => (
              <option key={key || "all-towns"} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Stage 2 / shortlist
          <select
            value={stage2}
            onChange={(e) => setStage2(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            {stage2Options.map(({ key, label }) => (
              <option key={key || "all-stage2"} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Allocation
          <select
            value={alloc}
            onChange={(e) => setAlloc(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            {INTERVIEW_ALLOCATION_FILTERS.map(({ key, label }) => (
              <option key={key || "all-alloc"} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Study Location
          <select
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            {INTERVIEW_LOCATION_FILTERS.map(({ key, label }) => (
              <option key={key || "all-loc"} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Institution
          <select
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            {institutionOptions.map(({ key, label }) => (
              <option key={key || "all-institutions"} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Interview date
          <select
            value={idate}
            onChange={(e) => setIdate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          >
            <option value="">All dates</option>
            {days.map((day) => (
              <option key={day.id} value={day.interview_date}>
                {day.label}
                {day.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-500">
          Search
          <div className="relative mt-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, university"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        {selectedVisible.length} selected of {applicants.length} visible
        {counts?.eligible != null ? ` · ${counts.eligible} eligible shortlisted` : ""}
        {counts?.scheduled != null ? ` · ${counts.scheduled} timed` : ""}
        {days.reduce((n, d) => n + (d.capacity || 0), 0) > 0 &&
        counts?.eligible > days.reduce((n, d) => n + (d.capacity || 0), 0)
          ? ` · Warning: eligible applicants exceed generated capacity (${days.reduce((n, d) => n + (d.capacity || 0), 0)}).`
          : ""}
      </p>

      {selectedVisible.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeDays.map((day) => (
            <button
              key={day.id}
              type="button"
              disabled={saving}
              onClick={() => requestPreview("allocate_physical", day.id)}
              className="rounded-lg bg-royal px-3 py-2 text-xs font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
            >
              Allocate to {day.label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => requestPreview("pending_remote")}
            className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Pending Remote Arrangement
          </button>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800"
          >
            <option value="">Choose a draft batch</option>
            {draftBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_name || `${batch.interview_date} ${batch.interview_time}`}
                {` · ${batch.booked || 0}/${batch.capacity || 0}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || !selectedBatchId}
            onClick={() => requestPreview("allocate_batch", null, { interview_slot_id: selectedBatchId })}
            className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            Assign to batch
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => requestPreview("unallocate")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Return to Unallocated
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100"
          >
            Clear selection
          </button>
        </div>
      ) : null}

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

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-royal" />
        </div>
      ) : applicants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Users size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No shortlisted applicants match these filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all visible applicants"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">Region of Study</th>
                <th className="px-4 py-3 font-medium">Town/City of Study</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Study Location</th>
                <th className="px-4 py-3 font-medium">Stage 2 status</th>
                <th className="px-4 py-3 font-medium">Interview allocation</th>
                <th className="px-4 py-3 font-medium">Date / time</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Response</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((row) => {
                const badge =
                  INTERVIEW_ALLOCATION_BADGE[row.allocation_state] ||
                  INTERVIEW_ALLOCATION_BADGE.unallocated;
                const eligibleStudy = row.virtual_eligibility?.eligible;
                return (
                  <tr key={row.id} className="border-t border-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={`Select ${row.full_name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/director/applications/${row.id}`}
                        className="font-semibold text-gray-900 hover:text-royal"
                      >
                        {row.full_name}
                      </Link>
                      <p className="text-xs text-gray-500">{row.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        {eligibleStudy ? <MapPin size={12} className="text-amber-600" /> : null}
                        <span className={eligibleStudy ? "font-medium text-amber-800" : "text-gray-700"}>
                          {row.effective_region || STUDY_LOCATION_UNCONFIRMED_LABEL}
                        </span>
                      </span>
                      {eligibleStudy ? (
                        <p className="mt-0.5 text-[11px] text-amber-700">Configured virtual-request region</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.town}</td>
                    <td className="px-4 py-3 text-gray-600">{row.study_institution}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          row.location_confirmed
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {row.location_label ||
                          (row.location_confirmed ? "Study location confirmed" : STUDY_LOCATION_UNCONFIRMED_LABEL)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openLocationForm(row)}
                        className="mt-1 block text-xs font-medium text-royal hover:underline"
                      >
                        {row.location_confirmed ? "Edit" : "Confirm"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.stage2_label}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.interview_date_label || "—"}
                      {row.appointment_label ? (
                        <p className="text-xs text-gray-500">{row.appointment_label}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {interviewModeLabel({
                        interviewFormat: row.interview_format,
                        responseStatus: row.response_status,
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.published_at ? interviewResponseLabel(row.response_status) : "Not published"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {locationForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Confirm study location</h2>
            <p className="mt-2 text-sm text-gray-600">
              {locationForm.name}. Record where the applicant is currently studying. Do not use hometown
              or residential region. Applicants are not notified.
            </p>
            <label className="mt-4 block text-xs font-medium text-gray-500">
              Region of Study
              <select
                value={locationForm.confirmed_region}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, confirmed_region: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
              >
                <option value="">Select Ghana region</option>
                {GHANA_REGIONS.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-gray-500">
              Town/City of Study
              <input
                type="text"
                value={locationForm.confirmed_town}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, confirmed_town: e.target.value }))
                }
                placeholder="e.g. Tamale"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-gray-500">
              Current Institution
              <input
                type="text"
                value={locationForm.study_institution}
                onChange={(e) =>
                  setLocationForm((prev) => ({ ...prev, study_institution: e.target.value }))
                }
                placeholder="Prefills from the application when available"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {locationForm.alreadyConfirmed ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={clearLocationConfirmation}
                  className="mr-auto rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Clear confirmation
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => setLocationForm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  !locationForm.confirmed_region ||
                  !locationForm.confirmed_town.trim() ||
                  !locationForm.study_institution.trim()
                }
                onClick={saveLocationConfirmation}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm study location
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">{confirm.preview?.title}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {confirm.preview?.count} applicant{confirm.preview?.count === 1 ? "" : "s"} will change.
              {confirm.preview?.skipped
                ? ` ${confirm.preview.skipped} selected row${confirm.preview.skipped === 1 ? "" : "s"} will be skipped.`
                : ""}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {confirm.preview?.window ? `Window: ${confirm.preview.window}. ` : ""}
              No email will be sent. Stage 2 status will not change.
            </p>
            {confirm.preview?.items?.length ? (
              <ul className="mt-3 max-h-48 overflow-y-auto text-sm text-gray-700">
                {confirm.preview.items.map((item) => (
                  <li key={item.id}>
                    {item.name}
                    {item.date ? ` · ${item.date}` : ""}
                    {item.time ? ` · ${item.time}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmChange}
                className="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
