"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
  UsersRound,
  FileText,
  Newspaper,
  Megaphone,
  MessageSquare,
  Video,
  Youtube,
  Calendar,
  FolderKanban,
  Mail,
} from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";

const directorNav = [
  { label: "Dashboard", href: "/director", icon: LayoutDashboard },
  { label: "Applications", href: "/director/applications", icon: FileText },
  { label: "Assessors", href: "/director/assessors", icon: UsersRound },
  { label: "Interviews", href: "/director/interviews", icon: Video },
  { label: "Panel Members", href: "/director/panel", icon: UsersRound },
  { label: "Scholars", href: "/director/scholars", icon: Users },
  { label: "Events", href: "/director/events", icon: Calendar },
  { label: "Teams & Mentors", href: "/director/teams", icon: UsersRound },
  { label: "Scholar Videos", href: "/director/scholar-videos", icon: Youtube },
  { label: "Projects", href: "/director/projects", icon: FolderKanban },
  { label: "News", href: "/director/news", icon: Newspaper },
  { label: "Messages", href: "/director/messages", icon: MessageCircle },
  { label: "Announcements", href: "/director/announcements", icon: Megaphone },
  { label: "Requests", href: "/director/requests", icon: MessageSquare },
  { label: "Audit Log", href: "/director/audit-log", icon: FileText },
  { label: "Settings", href: "/director/settings", icon: Settings },
  { label: "Email test", href: "/director/email-tests", icon: Mail },
  { label: "Auth health", href: "/director/auth-health", icon: Settings },
];

const panelNav = [
  { label: "Interview Applicants", href: "/panel", icon: FileText },
];

const assessorNav = [
  { label: "Assigned Applicants", href: "/assessor", icon: FileText },
];

function portalKind(pathname) {
  if (pathname?.startsWith("/panel")) return "panel";
  if (pathname?.startsWith("/assessor")) return "assessor";
  return "director";
}

function navForKind(kind) {
  if (kind === "panel") return panelNav;
  if (kind === "assessor") return assessorNav;
  return directorNav;
}

function roleLabel(kind) {
  if (kind === "panel") return "Panel Member";
  if (kind === "assessor") return "Assessor";
  return "Director";
}

function rootHrefForKind(kind) {
  if (kind === "panel") return "/panel";
  if (kind === "assessor") return "/assessor";
  return "/director";
}

export default function DashboardLayout({ children }) {
  const [profile, setProfile] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const kind = portalKind(pathname);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled || !session?.user) return;

        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (!cancelled) setProfile(data);
      } catch {
        if (!cancelled) setProfile(null);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    if (kind === "director") router.push("/director-login");
    else if (kind === "panel") router.push("/panel-login");
    else if (kind === "assessor") router.push("/assessor-login");
    else router.push("/login");
    router.refresh();
  }

  return (
    <DashboardShell
      navItems={navForKind(kind)}
      roleLabel={roleLabel(kind)}
      rootHref={rootHrefForKind(kind)}
      profile={profile}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
