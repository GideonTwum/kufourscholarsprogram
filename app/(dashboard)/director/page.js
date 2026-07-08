import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Users,
  FileText,
  Megaphone,
  MessageSquare,
  CalendarDays,
  UserCheck,
} from "lucide-react";

const quickActions = [
  {
    title: "Manage Scholars",
    description: "Manage scholar profiles and cohorts",
    icon: Users,
    href: "/director/scholars",
  },
  {
    title: "Review Applications",
    description: "Review and process applicant submissions",
    icon: FileText,
    href: "/director/applications",
  },
  {
    title: "Schedule Interviews",
    description: "Create interview batches and notify applicants",
    icon: CalendarDays,
    href: "/director/interviews",
  },
  {
    title: "Post Announcement",
    description: "Send updates and announcements",
    icon: Megaphone,
    href: "/director/announcements",
  },
  {
    title: "Messages",
    description: "Communicate directly with applicants",
    icon: MessageSquare,
    href: "/director/messages",
  },
  {
    title: "Manage Assessors",
    description: "Invite assessors and assign applicants for review",
    icon: UserCheck,
    href: "/director/assessors",
  },
];

export default async function DirectorDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/director-login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Director Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {profile?.full_name?.split(" ")[0] || "Director"}. Manage
          the Kufuor Scholars Program from here.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => (
          <a
            key={action.title}
            href={action.href}
            className="group flex flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-royal/5 text-royal transition-colors group-hover:bg-gold/10 group-hover:text-gold">
              <action.icon size={20} />
            </div>
            <h3 className="mt-4 font-semibold text-gray-900 group-hover:text-royal">
              {action.title}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{action.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
