"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Users,
  FileText,
  Megaphone,
  MessageSquare,
  Video,
} from "lucide-react";

const directorNav = [
  { label: "Dashboard", href: "/director", icon: LayoutDashboard },
  { label: "Applications", href: "/director/applications", icon: FileText },
  { label: "Interviews", href: "/director/interviews", icon: Video },
  { label: "Messages", href: "/director/messages", icon: MessageCircle },
  { label: "Announcements", href: "/director/announcements", icon: Megaphone },
  { label: "Requests", href: "/director/requests", icon: MessageSquare },
];

export default function DashboardLayout({ children }) {
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled || !session?.user) return;

        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) setProfile(null);
      }
    }
    loadProfile();
    return () => { cancelled = true; };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-lg transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal text-gold font-bold text-sm">
              KS
            </div>
            <span className="text-sm font-bold text-royal">
              Kufuor Scholars
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {directorNav.map((item) => {
              const isActive =
                mounted &&
                (pathname === item.href ||
                  (item.href !== "/director" &&
                    pathname.startsWith(item.href)));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-royal/5 text-royal"
                      : "text-gray-600 hover:bg-gray-50 hover:text-royal"
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                  {isActive && (
                    <ChevronRight
                      size={14}
                      className="ml-auto text-royal/50"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-gray-100 p-4">
          {profile && (
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                {profile.full_name
                  ? profile.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                  : "?"}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-gray-900">
                  {profile.full_name || "Director"}
                </p>
                <p className="truncate text-xs text-gray-500">Director</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-gray-100 bg-white px-4 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 lg:hidden"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-dark">
            Director
          </span>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
