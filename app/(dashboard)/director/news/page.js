"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, Plus, Loader2, Trash2, Edit, Star } from "lucide-react";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const CATEGORIES = ["Admissions", "Events", "Alumni", "Program"];

export default function DirectorNewsPage() {
  const supabase = createClient();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    category: "Program",
    excerpt: "",
    body: "",
    image: "/scholars14.jpg",
    featured: false,
    read_time: "3 min read",
    published_at: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false });
    setArticles(data || []);
    setLoading(false);
  }

  function openForm(article = null) {
    if (article) {
      setEditing(article.id);
      const d = article.published_at ? new Date(article.published_at) : new Date();
      setForm({
        title: article.title || "",
        slug: article.slug || "",
        category: article.category || "Program",
        excerpt: article.excerpt || "",
        body: article.body || "",
        image: article.image || "/scholars14.jpg",
        featured: !!article.featured,
        read_time: article.read_time || "3 min read",
        published_at: d.toISOString().slice(0, 16),
      });
    } else {
      setEditing(null);
      setForm({
        title: "",
        slug: "",
        category: "Program",
        excerpt: "",
        body: "",
        image: "/scholars14.jpg",
        featured: false,
        read_time: "3 min read",
        published_at: new Date().toISOString().slice(0, 16),
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
    const payload = {
      ...form,
      published_at: new Date(form.published_at).toISOString(),
    };
    if (editing) {
      await supabase.from("news_articles").update(payload).eq("id", editing);
    } else {
      await supabase.from("news_articles").insert(payload);
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this article?")) return;
    await supabase.from("news_articles").delete().eq("id", id);
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
          <h1 className="text-2xl font-bold text-gray-900">News Articles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage news and updates for the public website.
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal/90"
        >
          <Plus size={16} /> Add Article
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-bold text-gray-900">
            {editing ? "Edit Article" : "Add Article"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                onBlur={updateSlug}
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Slug *
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Excerpt
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Body
              </label>
              <textarea
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                rows={6}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Image URL
                </label>
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, image: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Read Time
                </label>
                <input
                  type="text"
                  value={form.read_time}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, read_time: e.target.value }))
                  }
                  placeholder="3 min read"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, featured: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Featured</span>
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  Published At
                </label>
                <input
                  type="datetime-local"
                  value={form.published_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, published_at: e.target.value }))
                  }
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white"
              >
                {editing ? "Update" : "Add"} Article
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <FileText size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">
            No articles yet. Add one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                {a.featured && (
                  <Star size={16} className="text-gold" fill="currentColor" />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">
                    {a.category} ·{" "}
                    {a.published_at
                      ? new Date(a.published_at).toLocaleDateString("en-GB")
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openForm(a)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-royal"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
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
