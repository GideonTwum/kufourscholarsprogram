import Link from "next/link";
import Image from "next/image";
import { Shield, Flag, Eye, Scale, Target, Award, Crown, Users, GraduationCap, Heart, Calendar, CheckCircle } from "lucide-react";

export const metadata = {
  title: "About Us | Kufuor Scholars Program",
  description:
    "The Kufuor Scholars Program identifies and nurtures exceptional young Ghanaians with leadership potential. Mission, vision, program pillars, and outcomes.",
};

const values = [
  { icon: Shield, label: "Integrity", description: "Upholding the highest moral and ethical standards in all we do." },
  { icon: Flag, label: "Patriotism", description: "Fostering love and service to the nation and continent." },
  { icon: Eye, label: "Transparency", description: "Promoting openness and accountability in leadership." },
  { icon: Scale, label: "Accountability", description: "Taking responsibility for impact and outcomes." },
];

const pillars = [
  { icon: Crown, title: "Leadership Training", description: "Intensive leadership development with real-world projects, public speaking, and strategic thinking workshops that prepare scholars for executive roles." },
  { icon: Users, title: "Mentorship", description: "One-on-one mentorship from industry leaders, former presidents, diplomats, and accomplished professionals across diverse sectors." },
  { icon: Heart, title: "Community Impact", description: "Hands-on community engagement projects that instill a deep sense of social responsibility and nation-building commitment." },
  { icon: GraduationCap, title: "Scholar Network", description: "Access to a powerful network of alumni, peers, and partners across Ghana and Africa for collaboration and career advancement." },
];

const timeline = [
  { year: "Year 1", title: "Foundation", items: ["Orientation and cohort bonding", "Core leadership workshops", "Mentor matching", "Community project initiation"] },
  { year: "Year 2", title: "Deepening", items: ["Advanced leadership modules", "Public speaking and advocacy", "Community project execution", "Networking events"] },
  { year: "Year 3", title: "Graduation", items: ["Capstone projects", "Alumni transition", "Leadership showcase", "Ongoing network engagement"] },
];

const outcomes = [
  "Executive-level leadership skills",
  "Lifelong mentorship relationships",
  "Track record of community impact",
  "Access to a pan-African network",
  "Enhanced public speaking and advocacy",
  "Career advancement opportunities",
  "Stipends to support participation",
];

export default function AboutPage() {
  return (
    <div className="pt-24">
      {/* Hero */}
      <div className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-gold"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            About the Program
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Building tomorrow&apos;s leaders today through mentorship, training,
            and community impact.
          </p>
        </div>
      </div>

      {/* Mission & Vision */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Our Mission
            </span>
            <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
              Identifying and Nurturing Exceptional Leaders
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              The Kufuor Scholars Program, an initiative of the John Agyekum
              Kufuor Foundation, identifies and nurtures exceptional young
              Ghanaians with leadership potential. Through a rigorous 3-year
              program, scholars are equipped with the skills, knowledge, and
              networks needed to drive positive change across Africa.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              We believe that investing in young leaders is the most impactful
              way to shape Africa&apos;s future. Our scholars go on to lead in
              government, business, civil society, and academia.
            </p>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src="/scholars.jpg"
                alt="Kufuor Scholars Program"
                width={800}
                height={600}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl bg-gold/20" />
          </div>
        </div>

        {/* Vision */}
        <div className="mt-24 rounded-2xl bg-gray-50 p-8 sm:p-12 lg:p-16">
          <div className="mx-auto max-w-3xl text-center">
            <Target className="mx-auto h-12 w-12 text-gold" />
            <h3 className="mt-4 text-2xl font-bold text-royal sm:text-3xl">
              Our Vision
            </h3>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              A Ghana and Africa where young leaders are empowered to serve with
              integrity, drive sustainable development, and inspire the next
              generation. We envision a continent led by principled,
              compassionate, and capable individuals committed to the common
              good.
            </p>
          </div>
        </div>

        {/* Founder&apos;s Legacy */}
        <div className="mt-24">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            The Legacy
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Founded on Presidential Excellence
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-600">
            The program is built on the legacy of His Excellency John Agyekum
            Kufuor, former President of Ghana (2001–2009). President Kufuor&apos;s
            leadership exemplified integrity, vision, and a deep commitment to
            Ghana&apos;s development. The John Agyekum Kufuor Foundation continues
            this legacy by investing in young people who will carry forward
            these values.
          </p>
          <div className="mt-8 flex items-center gap-4 rounded-xl bg-royal/5 p-6">
            <Award className="h-12 w-12 flex-shrink-0 text-gold" />
            <p className="text-gray-700">
              <span className="font-semibold text-royal">The Kufuor Scholars Program</span>{" "}
              embodies the belief that leadership is not about position—it&apos;s
              about service, character, and the courage to make a difference.
            </p>
          </div>
        </div>

        {/* Core Values */}
        <div className="mt-24">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            What We Stand For
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Our Core Values
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <div
                key={value.label}
                className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm transition-all duration-300 hover:border-gold/30 hover:shadow-md"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-royal/5 text-royal">
                  <value.icon size={24} />
                </div>
                <h4 className="mt-4 font-semibold text-royal">{value.label}</h4>
                <p className="mt-2 text-sm text-gray-500">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Program Pillars */}
        <div id="program" className="mt-24">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            What We Offer
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Program Pillars
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            Our program is built on four foundational pillars that together create
            leaders who are skilled, connected, and committed to service.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gold/5 transition-transform duration-300 group-hover:scale-150" />
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-royal text-gold">
                    <pillar.icon size={28} />
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-royal">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gray-500">{pillar.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3-Year Timeline */}
        <div className="mt-24">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Program Structure
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            The 3-Year Journey
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            Scholars progress through a structured curriculum that builds
            leadership capacity year over year.
          </p>
          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {timeline.map((phase) => (
              <div
                key={phase.year}
                className="rounded-2xl border border-gray-100 bg-gray-50/50 p-8"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-10 w-10 text-gold" />
                  <div>
                    <span className="text-sm font-semibold text-gold">{phase.year}</span>
                    <h3 className="text-xl font-bold text-royal">{phase.title}</h3>
                  </div>
                </div>
                <ul className="mt-6 space-y-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Outcomes */}
        <div className="mt-24 rounded-2xl bg-royal/5 p-8 sm:p-12">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            What Scholars Gain
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Program Outcomes
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-gray-600">
            Graduates of the Kufuor Scholars Program leave with tangible skills,
            relationships, and experiences that shape their leadership journey.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {outcomes.map((outcome) => (
              <li key={outcome} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-gold" />
                <span className="text-gray-700">{outcome}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-24 flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-center">
          <Link
            href="/scholars"
            className="inline-flex items-center gap-2 rounded-lg bg-royal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-royal/90"
          >
            Meet Our Scholars
          </Link>
          <Link
            href="/apply"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-royal px-6 py-3 text-sm font-semibold text-royal transition-colors hover:bg-royal/5"
          >
            Apply Now
          </Link>
        </div>
      </div>
    </div>
  );
}
