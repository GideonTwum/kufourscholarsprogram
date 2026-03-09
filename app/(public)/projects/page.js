import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderKanban, MapPin, Calendar, User } from "lucide-react";

export const metadata = {
  title: "Projects | Kufuor Scholars Program",
  description:
    "Community impact projects led by Kufuor Scholars. Explore initiatives driving positive change across Ghana and Africa.",
};

export default async function ProjectsPage() {
  let projects = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("projects")
      .select("id, title, slug, description, location, year, scholars(full_name, cohort_year, slug)")
      .order("year", { ascending: false });
    projects = data || [];
  } catch {}

  const placeholderProjects = [
    { id: "1", title: "Youth Leadership Bootcamp", slug: "youth-leadership-bootcamp", description: "Training young leaders in rural communities with skills in public speaking and project management.", location: "Kumasi", year: "2025", scholars: { full_name: "Ama Serwaa", cohort_year: "2024" } },
    { id: "2", title: "Digital Literacy Initiative", slug: "digital-literacy-initiative", description: "Bringing digital skills to underserved schools through volunteer-led workshops.", location: "Accra", year: "2025", scholars: { full_name: "Kwame Asante", cohort_year: "2024" } },
    { id: "3", title: "Community Health Outreach", slug: "community-health-outreach", description: "Mobile health screenings and awareness campaigns in northern Ghana.", location: "Tamale", year: "2024", scholars: { full_name: "Efua Mensah", cohort_year: "2023" } },
  ];

  const displayProjects = projects.length > 0 ? projects : placeholderProjects;

  return (
    <div className="pt-24">
      <div className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-gold"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Community Projects
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Scholar-led initiatives driving positive change across Ghana and
            Africa.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {displayProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal/10 text-royal transition-colors group-hover:bg-gold/20 group-hover:text-gold">
                <FolderKanban size={24} />
              </div>
              <div className="p-6">
                <h2 className="text-xl font-bold text-royal group-hover:text-gold">
                  {project.title}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm text-gray-600">
                  {project.description || "A community impact project by a Kufuor Scholar."}
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                  {project.scholars?.full_name && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {project.scholars.full_name}
                    </span>
                  )}
                  {project.year && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {project.year}
                    </span>
                  )}
                  {project.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {project.location}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
