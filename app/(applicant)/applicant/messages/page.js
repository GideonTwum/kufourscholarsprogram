"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2, ChevronRight, MessageSquarePlus } from "lucide-react";

export default function ApplicantMessagesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [contactError, setContactError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) { setLoading(false); return; }

      const convoIds = memberships.map((m) => m.conversation_id);
      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convoIds)
        .eq("type", "direct")
        .order("created_at", { ascending: false });

      const enriched = await Promise.all(
        (convos || []).map(async (convo) => {
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content, created_at")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", convo.id)
            .neq("user_id", user.id);

          let displayName = "Director";
          if (members && members.length > 0) {
            const { data: otherProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", members[0].user_id)
              .single();
            displayName = otherProfile?.full_name || "Director";
          }

          return {
            ...convo,
            displayName,
            lastMessage: lastMsg?.content || null,
            lastMessageAt: lastMsg?.created_at || convo.created_at,
          };
        })
      );

      enriched.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      setConversations(enriched);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 size={24} className="animate-spin text-royal" /></div>;
  }

  async function handleContactDirector() {
    setContacting(true);
    setContactError(null);
    try {
      const res = await fetch("/api/conversations/start-with-director", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start conversation");
      router.push(`/applicant/messages/${data.conversationId}`);
    } catch (err) {
      setContactError(err.message);
    } finally {
      setContacting(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="mt-1 text-sm text-gray-500">Communication with program directors.</p>
        </div>
        <button
          onClick={handleContactDirector}
          disabled={contacting}
          className="flex items-center justify-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-light disabled:opacity-50"
        >
          {contacting ? <Loader2 size={16} className="animate-spin" /> : <MessageSquarePlus size={16} />}
          Contact Directors
        </button>
      </div>

      {contactError && (
        <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {contactError}
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <MessageCircle size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No messages yet.</p>
          <p className="mt-1 text-xs text-gray-500">Click &quot;Contact Directors&quot; above to start a conversation.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => (
            <Link key={convo.id} href={`/applicant/messages/${convo.id}`} className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                {convo.displayName?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <p className="truncate font-semibold text-gray-900">{convo.displayName}</p>
                  <span className="ml-2 flex-shrink-0 text-[10px] text-gray-400">{convo.lastMessageAt ? new Date(convo.lastMessageAt).toLocaleDateString() : ""}</span>
                </div>
                <p className="truncate text-xs text-gray-500">{convo.lastMessage || "No messages yet"}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-royal" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
