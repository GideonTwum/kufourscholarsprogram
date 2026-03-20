import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ScholarsDirectory from "./ScholarsDirectory";

export const metadata = {
  title: "Meet Our Scholars | Kufuor Scholars Program",
  description:
    "Exceptional young leaders from across Africa studying in Ghana through the Kufuor Scholars Program.",
};

export default async function ScholarsPage({ searchParams }) {
  const params = await searchParams;
  const cohort = params?.cohort || "";
  const university = params?.university || "";

  let scholars = [];
  let cohorts = [];
  let universities = [];

  try {
    const supabase = await createClient();
    let query = supabase
      .from("scholars")
      .select("id, full_name, slug, cohort_year, university, field_of_study, photo_url, quote")
      .order("cohort_year", { ascending: false });

    if (cohort) query = query.eq("cohort_year", cohort);
    if (university) query = query.eq("university", university);

    const { data } = await query;
    scholars = data || [];

    const { data: allScholars } = await supabase
      .from("scholars")
      .select("cohort_year, university");
    const cohortSet = new Set();
    const universitySet = new Set();
    (allScholars || []).forEach((s) => {
      if (s.cohort_year) cohortSet.add(s.cohort_year);
      if (s.university) universitySet.add(s.university);
    });
    cohorts = [...cohortSet].sort().reverse();
    universities = [...universitySet].sort();
  } catch {}

  return (
    <div className="pt-24">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-royal"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold text-royal sm:text-5xl">
          Meet Our Scholars
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-600">
          Exceptional young leaders from across Africa, united by their studies
          in Ghana and a commitment to excellence and service.
        </p>

        <ScholarsDirectory
          scholars={scholars}
          cohorts={cohorts}
          universities={universities}
          selectedCohort={cohort}
          selectedUniversity={university}
        />
      </div>
    </div>
  );
}
