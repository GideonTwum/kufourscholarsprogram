"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Loader2, Users, Search, Video, FileText, Globe } from "lucide-react";

const audienceLabels = {
  all: { label: "Everyone", icon: Globe, color: "bg-blue-50 text-blue-700" },
  submitted: { label: "Submitted", icon: FileText, color: "bg-gray-50 text-gray-600" },
  under_review: { label: "Under Review", icon: Search, color: "bg-yellow-50 text-yellow-700" },
  shortlisted: { label: "Shortlisted", icon: Users, color: "bg-green-50 text-green-700" },
  interview: { label: "Interview", icon: Video, color: "bg-purple-50 text-purple-700" },
};

export default function ApplicantNewsPage() {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setError(null);
      const { data, error: err } = await supabase
        .from("announcements")
        .select("*, profiles:director_id (full_name)")
        .order("created_at", { ascending: false });
      if (err) setError(err.message);
      setAnnouncements(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 size={24} className="animate-spin text-royal" /></div>;
  }

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">News & Announcements</h1>
          <p className="mt-1 text-sm text-gray-500">Updates from the program directors.</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6">
          <p className="text-sm text-red-700">Unable to load announcements. Please try again later.</p>
          <p className="mt-1 text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">News & Announcements</h1>
        <p className="mt-1 text-sm text-gray-500">Updates from the program directors.</p>
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <Bell size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No announcements yet. Check back later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => {
            const meta = audienceLabels[ann.audience] || audienceLabels.all;
            return (
              <div key={ann.id} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-gold/10 text-gold">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{ann.title}</h3>
                      <p className="mt-0.5 text-xs text-gray-400">
                        By {ann.profiles?.full_name || "Director"} &middot; {new Date(ann.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.color}`}>
                    <meta.icon size={10} />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{ann.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
