"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Users } from "lucide-react";

export default function DirectorChatPage() {
  const { id: conversationId } = useParams();
  const supabase = createClient();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [userId, setUserId] = useState(null);
  const [convo, setConvo] = useState(null);
  const [members, setMembers] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: convoData } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single();
      setConvo(convoData);

      const { data: memberList } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);

      if (memberList) {
        const ids = memberList.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, photo_url")
          .in("id", ids);

        const map = {};
        (profiles || []).forEach((p) => {
          map[p.id] = p;
        });
        setMembers(map);
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);
      setLoading(false);
    }
    load();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMsg.trim() || sending) return;
    setSending(true);

    // Ensure director is a member before sending
    const { data: membership } = await supabase
      .from("conversation_members")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .single();

    if (!membership) {
      await supabase.from("conversation_members").insert({
        conversation_id: conversationId,
        user_id: userId,
      });
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: newMsg.trim(),
    });

    setNewMsg("");
    setSending(false);
  }

  let displayName = convo?.name || "Chat";
  if (convo?.type === "direct") {
    const other = Object.values(members).find((m) => m.id !== userId);
    if (other) displayName = other.full_name;
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-royal" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <Link
          href="/director/messages"
          className="text-gray-400 hover:text-royal"
        >
          <ArrowLeft size={18} />
        </Link>
        {convo?.type === "group" ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/10">
            <Users size={16} className="text-gold-dark" />
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
            {displayName
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "?"}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900">{displayName}</p>
          <p className="text-xs text-gray-500">
            {convo?.type === "group"
              ? `${Object.keys(members).length} members`
              : "Direct message"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            No messages yet.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.sender_id === userId;
              const sender = members[msg.sender_id];
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[75%] ${isMe ? "order-2" : ""}`}>
                    {!isMe && convo?.type === "group" && (
                      <p className="mb-0.5 text-[10px] font-medium text-gray-400">
                        {sender?.full_name || "Unknown"}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isMe
                          ? "bg-royal text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p
                      className={`mt-0.5 text-[10px] text-gray-400 ${
                        isMe ? "text-right" : ""
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-gray-100 pt-4"
      >
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={!newMsg.trim() || sending}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal text-white hover:bg-royal-light disabled:opacity-50"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
    </div>
  );
}
