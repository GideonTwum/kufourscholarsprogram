"use client";

import { useState, useEffect } from "react";
import {
  ToggleLeft,
  Loader2,
  CheckCircle2,
  Calendar,
  Clock,
  AlertCircle,
  MessageCircle,
  GraduationCap,
} from "lucide-react";
import { DEFAULT_APPLICATION_CLASS_NAME } from "@/lib/application-class";

export default function DirectorSettingsPage() {
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [applicationClassName, setApplicationClassName] = useState(DEFAULT_APPLICATION_CLASS_NAME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [savingExtras, setSavingExtras] = useState(false);
  const [message, setMessage] = useState(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/director/settings");
    const data = await res.json();
    if (res.ok) {
      setApplicationsOpen(Boolean(data.applications_open));
      setWhatsappUrl(data.accepted_whatsapp_group_url || "");
      setApplicationClassName(data.application_class_name || DEFAULT_APPLICATION_CLASS_NAME);
      if (data.application_deadline) {
        try {
          const d = new Date(data.application_deadline);
          setDeadlineDate(d.toISOString().slice(0, 10));
          setDeadlineTime(d.toTimeString().slice(0, 5));
        } catch (_) {}
      } else {
        setDeadlineDate("");
        setDeadlineTime("23:59");
      }
    } else {
      setMessage({ type: "error", text: data.error || "Failed to load settings" });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle() {
    setSaving(true);
    setMessage(null);
    const newValue = !applicationsOpen;
    const res = await fetch("/api/director/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applications_open: newValue }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Failed to update" });
    } else {
      setApplicationsOpen(newValue);
      setMessage({
        type: "success",
        text: newValue ? "Applications are now open." : "Applications are now closed.",
      });
      if (data.audit_warning) {
        setMessage({
          type: "success",
          text: `${newValue ? "Opened" : "Closed"} (audit warning: settings saved but audit log failed).`,
        });
      }
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
          Configure site-wide application settings. Changes are audited.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 flex items-start gap-2 rounded-lg p-4 ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <ToggleLeft size={20} />
          Application Status
        </h2>
        <p className="mb-6 text-sm text-gray-600">
          Control whether visitors can apply. When closed, the homepage shows applications closed.
        </p>

        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-4">
          <div>
            <p className="font-semibold text-gray-900">
              {applicationsOpen ? "Applications are open" : "Applications are closed"}
            </p>
          </div>
          <button
            type="button"
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

      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <GraduationCap size={20} />
          Current Application Class
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Used across the application portal, recruitment messaging, emails and applicant
          instructions.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Current Application Class
            </label>
            <input
              type="text"
              value={applicationClassName}
              onChange={(e) => setApplicationClassName(e.target.value)}
              placeholder="e.g. 11th Class"
              className="w-full max-w-md rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
            <p className="mt-1 text-xs text-gray-500">
              Example: 11th Class. Changing this later does not relabel applications already created.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSavingExtras(true);
              setMessage(null);
              const res = await fetch("/api/director/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  application_class_name: applicationClassName,
                  accepted_whatsapp_group_url: whatsappUrl,
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                setMessage({ type: "error", text: data.error || "Failed to save" });
              } else {
                setApplicationClassName(
                  data.settings?.application_class_name || applicationClassName
                );
                setWhatsappUrl(data.settings?.accepted_whatsapp_group_url || whatsappUrl);
                setMessage({ type: "success", text: "Application Class and acceptance settings saved." });
              }
              setSavingExtras(false);
            }}
            disabled={savingExtras}
            className="flex items-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal/90 disabled:opacity-50"
          >
            {savingExtras ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Save Class settings
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <Calendar size={20} />
          Application Deadline & Countdown
        </h2>
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
            type="button"
            onClick={async () => {
              setSavingDeadline(true);
              setMessage(null);
              const iso =
                deadlineDate && deadlineTime
                  ? new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
                  : "";
              const res = await fetch("/api/director/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ application_deadline: iso }),
              });
              const data = await res.json();
              if (!res.ok) {
                setMessage({ type: "error", text: data.error || "Failed to save deadline" });
              } else {
                setMessage({
                  type: "success",
                  text: iso
                    ? `Deadline set to ${new Date(iso).toLocaleString()}.`
                    : "Deadline cleared.",
                });
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
              type="button"
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

      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
          <MessageCircle size={20} />
          Acceptance
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          WhatsApp group link is shown only to accepted applicants.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Accepted Scholars WhatsApp Group URL
          </label>
          <input
            type="url"
            value={whatsappUrl}
            onChange={(e) => setWhatsappUrl(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
            className="w-full max-w-xl rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to hide the button on the accepted dashboard. Save via &quot;Save Class
            settings&quot; above.
          </p>
        </div>
      </div>
    </div>
  );
}
