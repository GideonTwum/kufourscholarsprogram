import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Linkedin, GraduationCap } from "lucide-react";

export async function generateMetadata({ params }) {
  const { year, slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("scholars")
    .select("full_name, university, field_of_study")
    .eq("cohort_year", year)
    .eq("slug", slug)
    .single();
  if (!data) return {};
  return {
    title: `${data.full_name} | Kufuor Scholars Program`,
    description: `${data.full_name} - ${data.university || ""} ${data.field_of_study || ""}`.trim(),
  };
}

export default async function ScholarProfilePage({ params }) {
  const { year, slug } = await params;
  const supabase = await createClient();

  const { data: scholar } = await supabase
    .from("scholars")
    .select("*")
    .eq("cohort_year", year)
    .eq("slug", slug)
    .single();

  if (!scholar) notFound();

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/scholars"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-royal"
        >
          ← Back to Scholars
        </Link>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-8 p-8 sm:flex-row sm:p-12">
            <div className="flex-shrink-0">
              <div className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br from-royal/20 to-gold/20 text-5xl font-bold text-royal">
                {(scholar.full_name || "?").charAt(0)}
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-royal">{scholar.full_name}</h1>
              <p className="mt-2 text-lg text-gray-600">
                {scholar.cohort_year}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                {scholar.university && (
                  <span className="flex items-center gap-1">
                    <GraduationCap size={16} />
                    {scholar.university}
                  </span>
                )}
                {scholar.field_of_study && (
                  <span>{scholar.field_of_study}</span>
                )}
              </div>
              {scholar.linkedin_url && (
                <a
                  href={scholar.linkedin_url}
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

          {scholar.quote && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-8 py-6 sm:px-12">
              <p className="text-lg italic text-gray-700">
                &ldquo;{scholar.quote}&rdquo;
              </p>
            </div>
          )}

          <div className="space-y-6 border-t border-gray-100 px-8 py-8 sm:px-12">
            {scholar.bio && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gold">
                  Bio
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">
                  {scholar.bio}
                </p>
              </div>
            )}
            {scholar.leadership_interests && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gold">
                  Leadership Interests
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">
                  {scholar.leadership_interests}
                </p>
              </div>
            )}
            {scholar.projects_summary && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gold">
                  Projects
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">
                  {scholar.projects_summary}
                </p>
              </div>
            )}
            {scholar.achievements && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gold">
                  Achievements
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-gray-600">
                  {scholar.achievements}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
