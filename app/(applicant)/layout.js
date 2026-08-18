"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Video,
  User,
  MessageCircle,
  Bell,
} from "lucide-react";
import NotificationsBell from "@/components/applicant/NotificationsBell";
import DashboardShell from "@/components/dashboard/DashboardShell";

const applicantNav = [
  { label: "Dashboard", href: "/applicant", icon: LayoutDashboard },
  { label: "My Application", href: "/applicant/application", icon: FileText },
  { label: "Stage 2 Video", href: "/applicant/stage2", icon: Video },
  { label: "My Profile", href: "/applicant/profile", icon: User },
  { label: "Messages", href: "/applicant/messages", icon: MessageCircle },
  { label: "News & Updates", href: "/applicant/news", icon: Bell },
];

export default function ApplicantLayout({ children }) {
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setReady(true);
        return;
      }
      // Unverified sessions must never see the Applicant Dashboard shell.
      if (user.email_confirmed_at == null) {
        router.replace("/applicant/verify-email");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(data);
      setReady(true);
    }
    loadProfile();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-royal border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardShell
      navItems={applicantNav}
      roleLabel="Applicant"
      rootHref="/applicant"
      profile={profile}
      onLogout={handleLogout}
      headerExtra={<NotificationsBell />}
    >
      {children}
    </DashboardShell>
  );
}
