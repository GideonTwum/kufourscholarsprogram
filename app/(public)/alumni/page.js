import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AlumniDirectory from "./AlumniDirectory";
import { GraduationCap, Briefcase, Users, Award } from "lucide-react";

export const metadata = {
  title: "Alumni | Kufuor Scholars Program",
  description:
    "Kufuor Scholars alumni making an impact across Ghana and Africa. Explore outcomes and connect with our graduate network.",
};

const outcomes = [
  { icon: Briefcase, label: "Leadership Roles", value: "Government, business, civil society, academia" },
  { icon: Users, label: "Alumni Network", value: "Ongoing mentorship and collaboration" },
  { icon: Award, label: "Community Impact", value: "Projects and initiatives across the continent" },
];

export default async function AlumniPage({ searchParams }) {
  const params = await searchParams;
  const cohort = params?.cohort || "";
  const university = params?.university || "";

  let alumni = [];
  let cohorts = [];
  let universities = [];

  try {
    const supabase = await createClient();
    let query = supabase
      .from("scholars")
      .select("id, full_name, slug, cohort_year, university, field_of_study, photo_url, quote, achievements")
      .eq("is_alumni", true)
      .order("cohort_year", { ascending: false });

    if (cohort) query = query.eq("cohort_year", cohort);
    if (university) query = query.eq("university", university);

    const { data } = await query;
    alumni = data || [];

    const { data: allAlumni } = await supabase
      .from("scholars")
      .select("cohort_year, university")
      .eq("is_alumni", true);
    const cohortSet = new Set();
    const universitySet = new Set();
    (allAlumni || []).forEach((s) => {
      if (s.cohort_year) cohortSet.add(s.cohort_year);
      if (s.university) universitySet.add(s.university);
    });
    cohorts = [...cohortSet].sort().reverse();
    universities = [...universitySet].sort();
  } catch {}

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
            Alumni
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Kufuor Scholars graduates making an impact across Ghana and Africa.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Outcomes */}
        <div className="mb-16 rounded-2xl bg-gray-50 p-8">
          <h2 className="mb-6 text-2xl font-bold text-royal">
            Alumni Outcomes
          </h2>
          <p className="mb-8 max-w-2xl text-gray-600">
            Our alumni go on to lead in diverse sectors, staying connected through
            the Scholars Alumni Network and continuing to drive positive change.
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {outcomes.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-4 rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-royal/10 text-royal">
                  <item.icon size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-royal">{item.label}</h3>
                  <p className="mt-1 text-sm text-gray-600">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Directory */}
        <div>
          <h2 className="mb-2 text-2xl font-bold text-royal">
            Alumni Directory
          </h2>
          <p className="mb-8 text-gray-600">
            Connect with graduates from across our cohorts.
          </p>
          <AlumniDirectory
            alumni={alumni}
            cohorts={cohorts}
            universities={universities}
            selectedCohort={cohort}
            selectedUniversity={university}
          />
        </div>
      </div>
    </div>
  );
}
