"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FolderKanban, Plus, Loader2, Trash2, Edit } from "lucide-react";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function DirectorProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState([]);
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    scholar_id: "",
    location: "",
    year: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: proj } = await supabase
      .from("projects")
      .select("*, scholars(full_name, cohort_year)")
      .order("year", { ascending: false });
    setProjects(proj || []);

    const { data: sch } = await supabase
      .from("scholars")
      .select("id, full_name, cohort_year")
      .order("full_name");
    setScholars(sch || []);

    setLoading(false);
  }

  function openForm(project = null) {
    if (project) {
      setEditing(project.id);
      setForm({
        title: project.title || "",
        slug: project.slug || "",
        description: project.description || "",
        scholar_id: project.scholar_id || "",
        location: project.location || "",
        year: project.year || "",
      });
    } else {
      setEditing(null);
      setForm({
        title: "",
        slug: "",
        description: "",
        scholar_id: "",
        location: "",
        year: new Date().getFullYear().toString(),
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
    const payload = { ...form, scholar_id: form.scholar_id || null };
    if (editing) {
      await supabase.from("projects").update(payload).eq("id", editing);
    } else {
      await supabase.from("projects").insert(payload);
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this project?")) return;
    await supabase.from("projects").delete().eq("id", id);
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
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">Manage scholar-led projects for the public website.</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
        >
          <Plus size={16} /> Add Project
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-bold text-gray-900">{editing ? "Edit Project" : "Add Project"}</h2>
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
              <label className="mb-1 block text-xs font-medium text-gray-500">Scholar Lead</label>
              <select
                value={form.scholar_id}
                onChange={(e) => setForm((f) => ({ ...f, scholar_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">— Select scholar —</option>
                {scholars.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.cohort_year})
                  </option>
                ))}
              </select>
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
                <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Year</label>
                <input
                  type="text"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white">
                {editing ? "Update" : "Add"} Project
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FolderKanban size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No projects yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-gray-900">{p.title}</p>
                <p className="text-xs text-gray-500">
                  {p.scholars?.full_name || "—"} · {p.year || "—"} · {p.location || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openForm(p)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-royal">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(p.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
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
