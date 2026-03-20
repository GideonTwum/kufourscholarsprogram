import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, UserCircle } from "lucide-react";
import MentorAvatar from "@/components/mentor/MentorAvatar";

export const metadata = {
  title: "Teams & Mentors | Kufuor Scholars Program",
  description:
    "Meet the leadership teams and mentors guiding the next generation of African leaders through the Kufuor Scholars Program.",
};

export default async function TeamsPage() {
  let teams = [];
  let mentors = [];
  try {
    const supabase = await createClient();
    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")
      .order("display_order", { ascending: true });
    teams = teamsData || [];

    const { data: mentorsData } = await supabase
      .from("mentors")
      .select("*")
      .order("display_order", { ascending: true });
    mentors = (mentorsData || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  } catch {}

  const mentorsByTeam = {};
  const standaloneMentors = [];
  mentors.forEach((m) => {
    if (m.team_id) {
      if (!mentorsByTeam[m.team_id]) mentorsByTeam[m.team_id] = [];
      mentorsByTeam[m.team_id].push(m);
    } else {
      standaloneMentors.push(m);
    }
  });

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
            Teams & Mentors
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            The people behind the Kufuor Scholars Program — leadership teams and mentors guiding exceptional young leaders.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Teams with their mentors */}
        {teams.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-8 flex items-center gap-2 text-2xl font-bold text-royal">
              <Users size={28} />
              Our Teams
            </h2>
            <div className="space-y-12">
              {teams.map((team) => {
                const teamMentors = mentorsByTeam[team.id] || [];
                return (
                  <div key={team.id} className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                    <h3 className="text-xl font-bold text-royal">{team.name}</h3>
                    {team.description && (
                      <p className="mt-2 text-gray-600">{team.description}</p>
                    )}
                    {teamMentors.length > 0 && (
                      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {teamMentors.map((mentor) => (
                          <Link
                            key={mentor.id}
                            href={`/teams/mentors/${mentor.slug}`}
                            className="group flex flex-col items-center rounded-xl border border-gray-50 p-6 text-center transition-all hover:border-gold/30 hover:shadow-md"
                          >
                            <MentorAvatar mentor={mentor} sizeClass="h-24 w-24 text-3xl" />
                            <h4 className="mt-4 font-semibold text-gray-900">{mentor.full_name}</h4>
                            {mentor.title && (
                              <p className="mt-1 text-sm text-gray-500">{mentor.title}</p>
                            )}
                            {mentor.expertise && (
                              <p className="mt-1 text-xs text-gold">{mentor.expertise}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Standalone mentors */}
        {(standaloneMentors.length > 0 || (teams.length === 0 && mentors.length > 0)) && (
          <section>
            <h2 className="mb-8 flex items-center gap-2 text-2xl font-bold text-royal">
              <UserCircle size={28} />
              Our Mentors
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(standaloneMentors.length > 0 ? standaloneMentors : mentors).map((mentor) => (
                <Link
                  key={mentor.id}
                  href={`/teams/mentors/${mentor.slug}`}
                  className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <MentorAvatar mentor={mentor} sizeClass="h-28 w-28 text-4xl" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{mentor.full_name}</h3>
                  {mentor.title && (
                    <p className="mt-1 text-sm text-gray-500">{mentor.title}</p>
                  )}
                  {mentor.expertise && (
                    <p className="mt-1 text-xs font-medium text-gold">{mentor.expertise}</p>
                  )}
                  {mentor.bio && (
                    <p className="mt-3 line-clamp-3 text-sm text-gray-600">{mentor.bio}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {teams.length === 0 && mentors.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-16 text-center">
            <Users size={48} className="mx-auto text-gray-300" />
            <p className="mt-4 text-gray-500">Teams and mentors will be listed here soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
