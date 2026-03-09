import Link from "next/link";
import Gallery from "@/components/landing/Gallery";

export const metadata = {
  title: "Gallery | Kufuor Scholars Program",
  description:
    "Life at Kufuor Scholars — moments from convocations, workshops, community outreach, and graduation ceremonies.",
};

export default function GalleryPage() {
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
            Gallery
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Capturing the transformative experiences of our scholars.
          </p>
        </div>
      </div>

      <Gallery />
    </div>
  );
}
