"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Loader2, Check } from "lucide-react";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const wrapperRef = useRef(null);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (!res.ok) return;
      setItems(json.notifications || []);
      setUnread(json.unread ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    function handleClickAway(e) {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function markOneRead(id) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-royal"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,22rem)] rounded-xl border border-gray-100 bg-white py-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 pb-2">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-royal hover:text-gold"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 size={22} className="animate-spin text-royal" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.is_read && markOneRead(n.id)}
                  className={`flex w-full gap-2 border-b border-gray-50 px-3 py-3 text-left last:border-0 ${
                    n.is_read ? "bg-white" : "bg-royal/[0.04]"
                  }`}
                >
                  {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-royal" />}
                  <div className={`min-w-0 flex-1 ${n.is_read ? "pl-0" : ""}`}>
                    <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{n.message}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.is_read && <Check size={14} className="mt-1 shrink-0 text-royal opacity-60" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
