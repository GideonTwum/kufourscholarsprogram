import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Linkedin, GraduationCap, ArrowLeft } from "lucide-react";
import MentorAvatar from "@/components/mentor/MentorAvatar";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentors")
    .select("full_name, title")
    .eq("slug", slug)
    .single();
  if (!data) return {};
  return {
    title: `${data.full_name} | Teams & Mentors | Kufuor Scholars Program`,
    description: data.title ? `${data.full_name} - ${data.title}` : `${data.full_name} | Kufuor Scholars Program Mentor`,
  };
}

export default async function MentorProfilePage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: mentor } = await supabase
    .from("mentors")
    .select("*, teams(name, slug)")
    .eq("slug", slug)
    .single();

  if (!mentor) notFound();

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/teams"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-royal"
        >
          <ArrowLeft size={16} /> Back to Teams & Mentors
        </Link>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-8 p-8 sm:flex-row sm:p-12">
            <div className="flex-shrink-0">
              <MentorAvatar mentor={mentor} sizeClass="h-40 w-40 text-5xl" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-royal">{mentor.full_name}</h1>
              {mentor.title && (
                <p className="mt-2 text-lg text-gray-600">{mentor.title}</p>
              )}
              {mentor.teams?.name && (
                <Link
                  href="/teams"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-royal"
                >
                  <GraduationCap size={14} />
                  {mentor.teams.name}
                </Link>
              )}
              {mentor.expertise && (
                <p className="mt-2 text-sm text-gold">{mentor.expertise}</p>
              )}
              {mentor.linkedin_url && (
                <a
                  href={mentor.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-royal hover:text-gold"
                >
                  <Linkedin size={18} />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
          {mentor.bio && (
            <div className="border-t border-gray-100 p-8 sm:p-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">About</h2>
              <p className="mt-4 whitespace-pre-wrap text-gray-700 leading-relaxed">{mentor.bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
