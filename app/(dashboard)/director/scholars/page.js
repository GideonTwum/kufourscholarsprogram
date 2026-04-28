"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users, Plus, Loader2, Trash2, Edit, Star } from "lucide-react";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function DirectorScholarsPage() {
  const supabase = createClient();
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    slug: "",
    cohort_year: "",
    university: "",
    field_of_study: "",
    bio: "",
    quote: "",
    leadership_interests: "",
    projects_summary: "",
    achievements: "",
    linkedin_url: "",
    occupation: "",
    email: "",
    school: "",
    photo_url: "",
    is_featured: false,
    is_alumni: false,
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("scholars")
      .select("*")
      .order("cohort_year", { ascending: false });
    setScholars(data || []);
    setLoading(false);
  }

  function openForm(scholar = null) {
    if (scholar) {
      setEditing(scholar.id);
      setForm({
        full_name: scholar.full_name || "",
        slug: scholar.slug || "",
        cohort_year: scholar.cohort_year || "",
        university: scholar.university || "",
        field_of_study: scholar.field_of_study || "",
        bio: scholar.bio || "",
        quote: scholar.quote || "",
        leadership_interests: scholar.leadership_interests || "",
        projects_summary: scholar.projects_summary || "",
        achievements: scholar.achievements || "",
        linkedin_url: scholar.linkedin_url || "",
        occupation: scholar.occupation || "",
        email: scholar.email || "",
        school: scholar.school || "",
        photo_url: scholar.photo_url || "",
        is_featured: scholar.is_featured || false,
        is_alumni: scholar.is_alumni || false,
      });
    } else {
      setEditing(null);
      setForm({
        full_name: "",
        slug: "",
        cohort_year: new Date().getFullYear().toString(),
        university: "",
        field_of_study: "",
        bio: "",
        quote: "",
        leadership_interests: "",
        projects_summary: "",
        achievements: "",
        linkedin_url: "",
        occupation: "",
        email: "",
        school: "",
        photo_url: "",
        is_featured: false,
        is_alumni: false,
      });
    }
    setShowForm(true);
  }

  function updateSlug() {
    if (form.full_name && !form.slug) {
      setForm((f) => ({ ...f, slug: slugify(f.full_name) }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, updated_at: new Date().toISOString() };
    if (editing) {
      await supabase.from("scholars").update(payload).eq("id", editing);
    } else {
      await supabase.from("scholars").insert(payload);
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this scholar?")) return;
    await supabase.from("scholars").delete().eq("id", id);
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
          <h1 className="text-2xl font-bold text-gray-900">Scholars Directory</h1>
          <p className="mt-1 text-sm text-gray-500">Manage scholar profiles for the public website.</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
        >
          <Plus size={16} /> Add Scholar
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-bold text-gray-900">{editing ? "Edit Scholar" : "Add Scholar"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Full Name *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
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
                  placeholder="url-friendly-id"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Cohort Year *</label>
                <input
                  type="text"
                  value={form.cohort_year}
                  onChange={(e) => setForm((f) => ({ ...f, cohort_year: e.target.value }))}
                  placeholder="2026"
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">University</label>
                <input
                  type="text"
                  value={form.university}
                  onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">School / Institution</label>
                <input
                  type="text"
                  value={form.school}
                  onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Occupation</label>
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Public email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Photo URL</label>
                <input
                  type="url"
                  value={form.photo_url}
                  onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="https://…"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Field of Study</label>
              <input
                type="text"
                value={form.field_of_study}
                onChange={(e) => setForm((f) => ({ ...f, field_of_study: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Quote (for spotlight)</label>
              <textarea
                value={form.quote}
                onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">LinkedIn URL</label>
              <input
                type="url"
                value={form.linkedin_url}
                onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                  className="rounded border-gray-300 text-royal"
                />
                <span className="text-sm">Featured (show in spotlight)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_alumni}
                  onChange={(e) => setForm((f) => ({ ...f, is_alumni: e.target.checked }))}
                  className="rounded border-gray-300 text-royal"
                />
                <span className="text-sm">Alumni</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white">
                {editing ? "Update" : "Add"} Scholar
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {scholars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Users size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No scholars yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scholars.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-royal/10 text-royal font-bold">
                  {(s.full_name || "?").charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{s.full_name}</p>
                  <p className="text-xs text-gray-500">
                    {s.cohort_year} · {s.university || "—"} {s.is_featured && <Star size={12} className="inline text-gold" />}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/scholars/${s.cohort_year}/${s.slug}`} target="_blank" className="text-xs text-royal hover:text-gold">
                  View
                </Link>
                <button onClick={() => openForm(s)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-royal">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
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
