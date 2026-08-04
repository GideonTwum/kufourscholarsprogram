"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, AlertCircle } from "lucide-react";
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_LABELS,
} from "@/lib/announcement-audiences";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all_applicants");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/director/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), content: body.trim(), audience }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(data.error || "Failed to create announcement");
      return;
    }
    router.push("/director/announcements");
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Link href="/director/announcements" className="text-gray-400 hover:text-royal">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Announcement</h1>
          <p className="text-sm text-gray-500">Choose a canonical audience for launch targeting.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {ANNOUNCEMENT_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {ANNOUNCEMENT_AUDIENCE_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Content</label>
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-lg border border-gray-200 p-3 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-lg bg-royal px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Publish
        </button>
      </form>
    </div>
  );
}
