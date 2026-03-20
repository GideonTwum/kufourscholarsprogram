"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Youtube, Plus, Loader2, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { getYoutubeVideoId } from "@/lib/youtube";

export default function DirectorScholarVideosPage() {
  const supabase = createClient();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    youtube_url: "",
    scholar_name: "",
    preview_seconds: 60,
    display_order: 0,
    is_published: true,
  });
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("scholar_videos")
      .select("*")
      .order("display_order", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }

  function openForm(row = null) {
    setUrlError("");
    setEditing(row?.id || null);
    setForm({
      title: row?.title || "",
      description: row?.description || "",
      youtube_url: row?.youtube_url || "",
      scholar_name: row?.scholar_name || "",
      preview_seconds: row?.preview_seconds ?? 60,
      display_order: row?.display_order ?? 0,
      is_published: row?.is_published ?? true,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setUrlError("");
    if (!getYoutubeVideoId(form.youtube_url)) {
      setUrlError("Paste a valid YouTube link (youtube.com/watch, youtu.be/, or shorts).");
      return;
    }
    const payload = {
      ...form,
      preview_seconds: Math.min(600, Math.max(10, Number(form.preview_seconds) || 60)),
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from("scholar_videos").update(payload).eq("id", editing);
    } else {
      await supabase.from("scholar_videos").insert(payload);
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Remove this video from the website?")) return;
    await supabase.from("scholar_videos").delete().eq("id", id);
    load();
  }

  async function togglePublished(row) {
    await supabase
      .from("scholar_videos")
      .update({ is_published: !row.is_published, updated_at: new Date().toISOString() })
      .eq("id", row.id);
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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scholar Videos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add YouTube links for the landing page. Visitors see a short preview (default 1 minute), then open YouTube for the full video.
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
        >
          <Plus size={16} /> Add video
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-bold text-gray-900">{editing ? "Edit video" : "Add video"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">YouTube URL *</label>
              <input
                type="url"
                value={form.youtube_url}
                onChange={(e) => setForm((f) => ({ ...f, youtube_url: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                required
              />
              {urlError && <p className="mt-1 text-xs text-red-600">{urlError}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Scholar name</label>
              <input
                type="text"
                value={form.scholar_name}
                onChange={(e) => setForm((f) => ({ ...f, scholar_name: e.target.value }))}
                placeholder="Who created this video?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Short description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Preview length (seconds)</label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={form.preview_seconds}
                  onChange={(e) => setForm((f) => ({ ...f, preview_seconds: +e.target.value || 60 }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                <p className="mt-1 text-xs text-gray-400">Shown on site before “watch full on YouTube” (10–600).</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Display order</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: +e.target.value || 0 }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                className="rounded border-gray-300 text-royal focus:ring-gold"
              />
              Published on landing page
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90">
                {editing ? "Update" : "Add"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {rows.length === 0 && !showForm && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center text-sm text-gray-500">
            No scholar videos yet. Add a YouTube link to show on the home page.
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Youtube className="shrink-0 text-red-600" size={22} />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{row.title}</p>
                <p className="truncate text-xs text-gray-500">{row.youtube_url}</p>
                {row.scholar_name && <p className="text-xs text-gray-600">{row.scholar_name}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.is_published ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {row.is_published ? "Live" : "Hidden"}
              </span>
              <button
                type="button"
                onClick={() => togglePublished(row)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-royal"
                title={row.is_published ? "Hide from site" : "Publish"}
              >
                {row.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => openForm(row)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-royal">
                <Edit size={16} />
              </button>
              <button onClick={() => handleDelete(row.id)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
