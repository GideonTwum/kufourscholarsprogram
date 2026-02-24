"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ToggleLeft, Loader2, CheckCircle2, Calendar, Clock } from "lucide-react";

export default function DirectorSettingsPage() {
  const supabase = createClient();
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: openData } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "applications_open")
        .single();
      setApplicationsOpen(openData?.value === "true");

      const { data: deadlineData } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "application_deadline")
        .single();
      if (deadlineData?.value) {
        try {
          const d = new Date(deadlineData.value);
          setDeadlineDate(d.toISOString().slice(0, 10));
          setDeadlineTime(d.toTimeString().slice(0, 5));
        } catch (_) {}
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleToggle() {
    setSaving(true);
    setMessage(null);
    const newValue = !applicationsOpen;

    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: "applications_open", value: String(newValue), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setApplicationsOpen(newValue);
      setMessage({
        type: "success",
        text: newValue ? "Applications are now open. Visitors can apply." : "Applications are now closed.",
      });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure site-wide settings visible to visitors.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-lg p-4 ${
            message.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message.type === "success" && (
            <CheckCircle2 size={18} className="mb-1 inline" />
          )}{" "}
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <ToggleLeft size={20} />
          Application Status
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          Control whether visitors can apply to the Kufuor Scholars Program. When closed, the homepage will show
          &ldquo;Applications closed&rdquo; and the Apply Now button will be disabled.
        </p>

        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <div>
            <p className="font-semibold text-gray-900">
              {applicationsOpen ? "Applications are open" : "Applications are closed"}
            </p>
            <p className="text-xs text-gray-500">
              {applicationsOpen
                ? "Visitors can submit applications."
                : "Visitors will see that applications are not currently accepted."}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-10 w-18 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              applicationsOpen ? "bg-royal" : "bg-gray-300"
            } ${saving ? "opacity-70" : ""}`}
          >
            <span
              className={`inline-block h-8 w-8 transform rounded-full bg-white shadow transition-transform ${
                applicationsOpen ? "translate-x-9" : "translate-x-1"
              }`}
            />
            {saving && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-white" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Application deadline / countdown */}
      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <Calendar size={20} />
          Application Deadline & Countdown
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          Set the date and time when applications close. A countdown will appear on the homepage so visitors know how much time they have left to apply.
        </p>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
            <input
              type="date"
              value={deadlineDate}
              onChange={(e) => setDeadlineDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
            <input
              type="time"
              value={deadlineTime}
              onChange={(e) => setDeadlineTime(e.target.value)}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <button
            onClick={async () => {
              setSavingDeadline(true);
              setMessage(null);
              const iso = deadlineDate && deadlineTime
                ? new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
                : "";
              const { error } = await supabase
                .from("site_settings")
                .upsert(
                  { key: "application_deadline", value: iso, updated_at: new Date().toISOString() },
                  { onConflict: "key" }
                );
              if (error) {
                setMessage({ type: "error", text: error.message });
              } else {
                setMessage({ type: "success", text: iso ? `Deadline set to ${new Date(iso).toLocaleString()}. Countdown will appear on the homepage.` : "Deadline cleared. Countdown will no longer appear." });
              }
              setSavingDeadline(false);
            }}
            disabled={savingDeadline}
            className="flex items-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
          >
            {savingDeadline ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
            Save Deadline
          </button>
          {deadlineDate && (
            <button
              onClick={() => {
                setDeadlineDate("");
                setDeadlineTime("23:59");
              }}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
