"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Plus, Loader2, Trash2, Edit } from "lucide-react";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function DirectorEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    event_date: "",
    event_time: "",
    location: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });
    setEvents(data || []);
    setLoading(false);
  }

  function openForm(event = null) {
    if (event) {
      setEditing(event.id);
      setForm({
        title: event.title || "",
        slug: event.slug || "",
        description: event.description || "",
        event_date: event.event_date || "",
        event_time: event.event_time || "",
        location: event.location || "",
      });
    } else {
      setEditing(null);
      setForm({
        title: "",
        slug: "",
        description: "",
        event_date: "",
        event_time: "9:00 AM",
        location: "",
      });
    }
    setShowForm(true);
  }

  function updateSlug() {
    if (form.title && !form.slug) {
      setForm((f) => ({ ...f, slug: slugify(f.title) }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (editing) {
      await supabase.from("events").update(form).eq("id", editing);
    } else {
      await supabase.from("events").insert(form);
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("events").delete().eq("id", id);
    load();
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-500">Manage leadership events for the public website.</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
        >
          <Plus size={16} /> Add Event
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-bold text-gray-900">{editing ? "Edit Event" : "Add Event"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onBlur={updateSlug}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Date *</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                <input
                  type="text"
                  value={form.event_time}
                  onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
                  placeholder="9:00 AM"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white">
                {editing ? "Update" : "Add"} Event
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Calendar size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No events yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-gray-900">{ev.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(ev.event_date).toLocaleDateString()} {ev.event_time && `· ${ev.event_time}`} · {ev.location || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/events`} target="_blank" className="text-xs text-royal hover:text-gold">
                  View
                </a>
                <button onClick={() => openForm(ev)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-royal">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(ev.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
