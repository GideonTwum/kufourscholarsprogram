"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Loader2, Globe, FileText, Search, Users, Video,
} from "lucide-react";

const audiences = [
  { value: "all", label: "All Applicants", icon: Globe },
  { value: "submitted", label: "Submitted Only", icon: FileText },
  { value: "under_review", label: "Under Review", icon: Search },
  { value: "shortlisted", label: "Shortlisted Only", icon: Users },
  { value: "interview", label: "Interview Stage", icon: Video },
];

export default function NewAnnouncementPage() {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("announcements").insert({
      director_id: user.id,
      title: title.trim(),
      body: body.trim(),
      audience,
    });

    if (!error) router.push("/director/announcements");
    setSending(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/director/announcements" className="text-gray-400 hover:text-royal"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Announcement</h1>
          <p className="mt-1 text-sm text-gray-500">Broadcast a message to applicants.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Write your announcement..." className="w-full rounded-lg border border-gray-200 p-3 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20" required />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Target Audience</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {audiences.map((a) => (
              <button key={a.value} type="button" onClick={() => setAudience(a.value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${audience === a.value ? "border-royal bg-royal/5 text-royal" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                <a.icon size={14} /> {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={sending || !title.trim() || !body.trim()} className="flex items-center gap-1.5 rounded-lg bg-gold px-6 py-2.5 text-sm font-bold text-royal hover:bg-gold-light disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Publish Announcement
          </button>
        </div>
      </form>
    </div>
  );
}
