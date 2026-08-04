"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Plus,
  Loader2,
  Trash2,
  Globe,
  FileText,
  Search,
  Users,
  Video,
  AlertCircle,
} from "lucide-react";
import { ANNOUNCEMENT_AUDIENCE_LABELS } from "@/lib/announcement-audiences";

const iconByAudience = {
  all_applicants: Globe,
  stage_1_submitted: Search,
  stage_1_approved: Users,
  stage_2_submitted: Users,
  called_for_interview: Video,
  accepted: Users,
  rejected: FileText,
  assessors: Users,
  panel: Users,
  all_staff: Globe,
};

export default function DirectorAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/director/announcements");
    const data = await res.json();
    if (!res.ok) setError(data.error || "Failed to load announcements");
    else setAnnouncements(data.announcements || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this announcement?")) return;
    const res = await fetch(`/api/director/announcements?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    else {
      const data = await res.json();
      setError(data.error || "Delete failed");
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="mt-1 text-sm text-gray-500">Broadcast news and updates.</p>
        </div>
        <Link
          href="/director/announcements/new"
          className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-light"
        >
          <Plus size={16} /> New Announcement
        </Link>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Bell size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => {
            const Icon = iconByAudience[ann.audience] || Globe;
            const label = ANNOUNCEMENT_AUDIENCE_LABELS[ann.audience] || ann.audience;
            return (
              <div key={ann.id} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{ann.title}</h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      By {ann.profiles?.full_name || "Director"} ·{" "}
                      {new Date(ann.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                      <Icon size={10} /> {label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(ann.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">{ann.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
