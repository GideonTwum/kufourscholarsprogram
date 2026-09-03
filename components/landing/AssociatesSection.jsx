import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ASSOCIATES_APPLY_URL,
  ASSOCIATES_PAGE_HREF,
  ASSOCIATES_PHOTOS,
} from "@/lib/associates";

/**
 * Homepage introduction to Kufuor Scholar Associates.
 * Distinct from the main Scholars Program / 11th Class campaign.
 */
export default function AssociatesSection() {
  const { main, community, leadership } = ASSOCIATES_PHOTOS;

  return (
    <section
      id="associates"
      aria-labelledby="associates-heading"
      className="border-y border-royal/10 bg-gray-50 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Kufuor Scholar Associates
            </span>
            <h2
              id="associates-heading"
              className="mt-3 text-3xl font-bold text-royal sm:text-4xl"
            >
              Another Way to Be Part of the Kufuor Scholars Community
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
              The Kufuor Scholar Associates community provides an opportunity for
              individuals who may not be eligible for, or selected into, the main
              Kufuor Scholars Program to remain connected to a network committed to
              leadership, service and personal development.
            </p>
            <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
              Whether you previously applied to the Kufuor Scholars Program, no
              longer meet the eligibility criteria, or simply want to engage with
              the wider community, there is still an opportunity to connect,
              contribute and grow.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Associates are part of the wider Kufuor Scholars community and are
              not designated as Kufuor Scholars.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={ASSOCIATES_APPLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-7 py-3.5 text-sm font-semibold text-royal shadow-lg shadow-gold/20 transition-all duration-200 hover:bg-gold-light hover:shadow-xl hover:shadow-gold/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Join the Associates Community
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <Link
                href={ASSOCIATES_PAGE_HREF}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-royal/25 bg-white px-7 py-3.5 text-sm font-semibold text-royal transition-all duration-200 hover:border-royal/45 hover:bg-royal/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
              >
                Learn More
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="col-span-2 overflow-hidden rounded-2xl border border-royal/10 bg-white shadow-md shadow-royal/5">
                <Image
                  src={main.src}
                  alt={main.alt}
                  width={main.width}
                  height={main.height}
                  className="h-auto w-full object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-royal/10 bg-white shadow-sm">
                <Image
                  src={community.src}
                  alt={community.alt}
                  width={community.width}
                  height={community.height}
                  className="aspect-[4/5] h-full w-full object-cover object-center"
                  sizes="(max-width: 1024px) 50vw, 20vw"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-royal/10 bg-white shadow-sm">
                <Image
                  src={leadership.src}
                  alt={leadership.alt}
                  width={leadership.width}
                  height={leadership.height}
                  className="aspect-[4/5] h-full w-full object-cover object-center"
                  sizes="(max-width: 1024px) 50vw, 20vw"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
