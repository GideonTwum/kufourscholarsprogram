import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Calendar, User, FolderKanban } from "lucide-react";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("title, description")
    .eq("slug", slug)
    .single();
  if (!data) return {};
  return {
    title: `${data.title} | Kufuor Scholars Program`,
    description: data.description || `Community project: ${data.title}`,
  };
}

export default async function ProjectDetailPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, scholars(id, full_name, cohort_year, slug)")
    .eq("slug", slug)
    .single();

  if (!project) notFound();

  const scholar = project.scholars;
  const impactMetrics = project.impact_metrics || {};

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/projects"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-royal"
        >
          ← Back to Projects
        </Link>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-8 p-8 sm:flex-row sm:p-12">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-royal/10 text-royal">
              <FolderKanban size={32} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-royal">{project.title}</h1>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                {scholar?.full_name && (
                  <Link
                    href={`/scholars/${scholar.cohort_year}/${scholar.slug}`}
                    className="flex items-center gap-1 font-medium text-royal hover:text-gold"
                  >
                    <User size={16} />
                    {scholar.full_name}
                  </Link>
                )}
                {project.year && (
                  <span className="flex items-center gap-1">
                    <Calendar size={16} />
                    {project.year}
                  </span>
                )}
                {project.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={16} />
                    {project.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {project.description && (
            <div className="border-t border-gray-100 px-8 py-8 sm:px-12">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gold">
                About the Project
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-gray-600">
                {project.description}
              </p>
            </div>
          )}

          {Object.keys(impactMetrics).length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50/50 px-8 py-8 sm:px-12">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gold">
                Impact
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {Object.entries(impactMetrics).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg bg-white p-4 shadow-sm"
                  >
                    <p className="text-sm font-medium text-royal">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-lg font-bold text-gray-900">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scholar && (
            <div className="border-t border-gray-100 px-8 py-6 sm:px-12">
              <Link
                href={`/scholars/${scholar.cohort_year}/${scholar.slug}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-royal hover:text-gold"
              >
                View Scholar Profile →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
