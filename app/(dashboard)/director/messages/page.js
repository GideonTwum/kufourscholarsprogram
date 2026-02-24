"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  MessageCircle,
  Users,
  Loader2,
  ChevronRight,
} from "lucide-react";

export default function DirectorMessagesPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Get all conversations the director is a member of
      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        setLoading(false);
        return;
      }

      const convoIds = memberships.map((m) => m.conversation_id);

      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convoIds)
        .order("created_at", { ascending: false });

      const enriched = await Promise.all(
        (convos || []).map(async (convo) => {
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content, created_at, sender_id")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          let displayName = convo.name;

          if (convo.type === "direct") {
            const { data: members } = await supabase
              .from("conversation_members")
              .select("user_id")
              .eq("conversation_id", convo.id)
              .neq("user_id", user.id);

            if (members && members.length > 0) {
              const { data: otherProfile } = await supabase
                .from("profiles")
                .select("full_name, photo_url")
                .eq("id", members[0].user_id)
                .single();

              displayName = otherProfile?.full_name || "Unknown";
              convo.otherPhoto = otherProfile?.photo_url;
            }
          }

          return {
            ...convo,
            displayName: displayName || "Conversation",
            lastMessage: lastMsg?.content || null,
            lastMessageAt: lastMsg?.created_at || convo.created_at,
          };
        })
      );

      enriched.sort(
        (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
      );

      setConversations(enriched);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Communicate with scholars and cohort groups.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <MessageCircle size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">
            No conversations yet. Messages from scholars will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((convo) => (
            <Link
              key={convo.id}
              href={`/director/messages/${convo.id}`}
              className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {convo.type === "group" ? (
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Users size={18} className="text-gold-dark" />
                </div>
              ) : convo.otherPhoto ? (
                <img
                  src={convo.otherPhoto}
                  alt=""
                  className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                  {convo.displayName
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <p className="truncate font-semibold text-gray-900">
                    {convo.displayName}
                  </p>
                  <span className="ml-2 flex-shrink-0 text-[10px] text-gray-400">
                    {convo.lastMessageAt
                      ? new Date(convo.lastMessageAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <p className="truncate text-xs text-gray-500">
                  {convo.lastMessage || "No messages yet"}
                </p>
              </div>
              <ChevronRight
                size={14}
                className="text-gray-300 group-hover:text-royal"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
