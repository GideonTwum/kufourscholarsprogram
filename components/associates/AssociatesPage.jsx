import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Users,
  GraduationCap,
  Clock,
  Heart,
  Network,
  BookOpen,
  HandHeart,
  Sparkles,
} from "lucide-react";
import {
  ASSOCIATES_APPLY_URL,
  ASSOCIATES_PHOTOS,
} from "@/lib/associates";

const audiences = [
  {
    title: "Previous KSP Applicants",
    description:
      "Individuals who applied to become Kufuor Scholars but were not selected through the final recruitment process.",
    icon: GraduationCap,
  },
  {
    title: "Those Outside the Eligibility Criteria",
    description:
      "Individuals who are interested in the Kufuor Scholars community but do not currently meet one or more of the eligibility requirements for the main Scholars Program.",
    icon: Users,
  },
  {
    title: "Those Who Have Passed the Eligibility Window",
    description:
      "Individuals whose age, academic level or other circumstances mean they are no longer eligible to apply to become Kufuor Scholars.",
    icon: Clock,
  },
  {
    title: "Friends of the KSP Community",
    description:
      "Individuals who identify with the values of leadership, service and personal development and want to connect with the wider Kufuor Scholars community.",
    icon: Heart,
  },
];

const benefits = [
  {
    title: "Community",
    description:
      "Connect with people who share an interest in leadership, service and development.",
    icon: Users,
  },
  {
    title: "Learning",
    description:
      "Engage with opportunities that encourage personal growth, learning and exposure.",
    icon: BookOpen,
  },
  {
    title: "Service & Contribution",
    description:
      "Participate in initiatives that contribute to communities and the wider KSP ecosystem.",
    icon: HandHeart,
  },
  {
    title: "Network",
    description:
      "Stay connected to the broader Kufuor Scholars community.",
    icon: Network,
  },
];

const scholarPoints = [
  "Selected through the formal Scholars recruitment process",
  "Meet the Scholars eligibility criteria",
  "Participate in the main Kufuor Scholars Program",
];

const associatePoints = [
  "Part of the wider KSP community",
  "May include previous applicants or individuals outside the Scholars eligibility criteria",
  "Engage through the Associates pathway",
  "Are not designated as Kufuor Scholars",
];

function JoinAssociatesCta({ className = "" }) {
  return (
    <a
      href={ASSOCIATES_APPLY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ||
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-7 py-3.5 text-sm font-semibold text-royal shadow-lg shadow-gold/20 transition-all duration-200 hover:bg-gold-light hover:shadow-xl hover:shadow-gold/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      }
    >
      Join the Associates Community
      <ArrowRight size={16} aria-hidden="true" />
    </a>
  );
}

export default function AssociatesPage() {
  const { main, community, leadership, gathering } = ASSOCIATES_PHOTOS;

  return (
    <div>
      {/* Hero */}
      <section
        aria-labelledby="associates-hero-heading"
        className="relative overflow-hidden bg-royal"
      >
        <div className="absolute inset-0 opacity-25">
          <Image
            src={gathering.src}
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-royal via-royal/90 to-royal/70" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
          <Link
            href="/"
            className="mb-4 block w-fit text-sm font-medium text-white/60 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            ← Back to Home
          </Link>
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">
            Kufuor Scholar Associates
          </p>
          <h1
            id="associates-hero-heading"
            className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl"
          >
            Stay Connected. Keep Growing. Be Part of the Community.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
            Not everyone who wants to engage with the Kufuor Scholars community
            will qualify for the main Scholars Program. Kufuor Scholar Associates
            provides another pathway for individuals who share the values of
            leadership, service and personal development to remain connected to
            the wider Kufuor Scholars community.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <JoinAssociatesCta />
            <a
              href="#who-associates-is-for"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gold/35 bg-transparent px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-gold/55 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Learn Who Associates Is For
            </a>
          </div>
        </div>
      </section>

      {/* What is Associates */}
      <section
        aria-labelledby="what-is-associates-heading"
        className="bg-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Understanding the Pathway
            </span>
            <h2
              id="what-is-associates-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              What Is Kufuor Scholar Associates?
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              Kufuor Scholar Associates is an extended community connected to the
              Kufuor Scholars Program. It is designed for individuals who want to
              remain engaged with the values, people and wider network of the
              Kufuor Scholars community even though they are not participating as
              Kufuor Scholars.
            </p>
            <ul className="mt-8 space-y-3 text-base text-gray-600">
              <li className="flex gap-3">
                <Sparkles className="mt-1 shrink-0 text-gold" size={18} aria-hidden="true" />
                <span>Associates belong to the wider KSP community.</span>
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-1 shrink-0 text-gold" size={18} aria-hidden="true" />
                <span>Associates are not automatically Kufuor Scholars.</span>
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-1 shrink-0 text-gold" size={18} aria-hidden="true" />
                <span>
                  Associate status does not replace the Scholar selection process.
                </span>
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-1 shrink-0 text-gold" size={18} aria-hidden="true" />
                <span>
                  Becoming an Associate does not guarantee future admission into
                  the Kufuor Scholars Program.
                </span>
              </li>
            </ul>
            <aside
              className="mt-10 rounded-2xl border border-royal/15 bg-royal/[0.04] p-5 sm:p-6"
              role="note"
            >
              <p className="text-sm leading-relaxed text-royal sm:text-base">
                Being a Kufuor Scholar Associate does not mean that an individual
                is a Kufuor Scholar, nor does it automatically lead to admission
                into the Kufuor Scholars Program.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section
        id="who-associates-is-for"
        aria-labelledby="who-associates-heading"
        className="bg-gray-50 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Audience
            </span>
            <h2
              id="who-associates-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              Who Kufuor Scholar Associates Is For
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              The Associates pathway welcomes people who want to stay connected
              to the Kufuor Scholars community through a route that is distinct
              from the main Scholars Program.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {audiences.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal/5 text-royal">
                  <item.icon size={24} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-royal">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why join */}
      <section
        aria-labelledby="why-join-associates-heading"
        className="bg-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Opportunities
            </span>
            <h2
              id="why-join-associates-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              Why Join the Associates Community?
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Associates may engage with community, learning and service
              opportunities connected to the wider Kufuor Scholars ecosystem.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-gray-100 bg-gray-50/80 p-6 text-center shadow-sm"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-royal/5 text-royal">
                  <item.icon size={24} aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-bold text-royal">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Scholars vs Associates */}
      <section
        aria-labelledby="scholars-vs-associates-heading"
        className="border-y border-royal/10 bg-royal/[0.03] py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Clarity of Status
            </span>
            <h2
              id="scholars-vs-associates-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              Scholars and Associates
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              Both pathways reflect a shared interest in leadership and service.
              They are different programme statuses within the wider Kufuor
              Scholars community.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-royal/15 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="text-xl font-bold text-royal">Kufuor Scholars</h3>
              <ul className="mt-6 space-y-3">
                {scholarPoints.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-gray-600 sm:text-base">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-gold/30 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="text-xl font-bold text-royal">
                Kufuor Scholar Associates
              </h3>
              <ul className="mt-6 space-y-3">
                {associatePoints.map((point) => (
                  <li key={point} className="flex gap-3 text-sm text-gray-600 sm:text-base">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-royal" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* Photo / community */}
      <section
        aria-labelledby="associates-community-photos-heading"
        className="bg-white py-20 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Community
            </span>
            <h2
              id="associates-community-photos-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              A Wider Community of Emerging Leaders
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              The Kufuor Scholars ecosystem brings people together around shared
              values of leadership, service and personal development.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[main, community, leadership, gathering].map((photo) => (
              <div
                key={photo.src}
                className="overflow-hidden rounded-2xl border border-royal/10 bg-gray-50 shadow-sm"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  className="aspect-[4/5] h-full w-full object-cover object-center"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        aria-labelledby="associates-final-cta-heading"
        className="bg-royal py-20 sm:py-24"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2
            id="associates-final-cta-heading"
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            There Is Still a Place for You in the Community
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-white/75">
            If you want to remain connected to the Kufuor Scholars community,
            continue developing yourself and contribute to a wider network of
            emerging leaders, explore the Kufuor Scholar Associates pathway.
          </p>
          <div className="mt-8 flex justify-center">
            <JoinAssociatesCta />
          </div>
        </div>
      </section>
    </div>
  );
}
