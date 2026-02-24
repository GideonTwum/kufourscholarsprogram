"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Bell, Plus, Loader2, Trash2, Globe, FileText, Search, Users, Video,
} from "lucide-react";

const audienceLabels = {
  all: { label: "Everyone", icon: Globe, color: "bg-blue-50 text-blue-700" },
  submitted: { label: "Submitted", icon: FileText, color: "bg-gray-50 text-gray-600" },
  under_review: { label: "Under Review", icon: Search, color: "bg-yellow-50 text-yellow-700" },
  shortlisted: { label: "Shortlisted", icon: Users, color: "bg-green-50 text-green-700" },
  interview: { label: "Interview", icon: Video, color: "bg-purple-50 text-purple-700" },
};

export default function DirectorAnnouncementsPage() {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("*, profiles:director_id (full_name)")
        .order("created_at", { ascending: false });
      setAnnouncements(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 size={24} className="animate-spin text-royal" /></div>;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="mt-1 text-sm text-gray-500">Broadcast news and updates to applicants.</p>
        </div>
        <Link href="/director/announcements/new" className="flex items-center gap-1.5 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-light">
          <Plus size={16} /> New Announcement
        </Link>
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Bell size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => {
            const meta = audienceLabels[ann.audience] || audienceLabels.all;
            return (
              <div key={ann.id} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{ann.title}</h3>
                    <p className="mt-0.5 text-xs text-gray-400">
                      By {ann.profiles?.full_name || "Director"} &middot; {new Date(ann.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.color}`}>
                      <meta.icon size={10} /> {meta.label}
                    </span>
                    <button onClick={() => handleDelete(ann.id)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{ann.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
