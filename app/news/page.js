import { articles, categoryColors } from "@/lib/news-data";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "News & Updates | Kufuor Scholars Program",
  description:
    "Stay up to date with the latest news, events, and updates from the Kufuor Scholars Program.",
};

export default function NewsPage() {
  const featured = articles.find((a) => a.featured);
  const rest = articles.filter((a) => !a.featured);

  return (
    <main className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-gold"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
            News &amp; Updates
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/60">
            Stay informed about the latest happenings at the Kufuor Scholars
            Program — from admissions and events to alumni stories and
            partnerships.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Featured article */}
        {featured && (
          <Link
            href={`/news/${featured.slug}`}
            className="group mb-12 grid overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:shadow-lg md:grid-cols-2"
          >
            <div className="relative aspect-[16/9] overflow-hidden md:aspect-auto md:min-h-[360px]">
              <Image
                src={featured.image}
                alt={featured.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute left-4 top-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[featured.category]}`}
                >
                  {featured.category}
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center p-8 md:p-10">
              <span className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold">
                Featured
              </span>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {featured.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {featured.readTime}
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-royal transition-colors group-hover:text-gold sm:text-3xl">
                {featured.title}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-500 sm:text-base">
                {featured.excerpt}
              </p>
              <span className="mt-6 flex items-center gap-1 text-sm font-semibold text-royal transition-colors group-hover:text-gold">
                Read full article
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        )}

        {/* All articles grid */}
        <h2 className="mb-8 text-2xl font-bold text-royal">All Articles</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((article) => (
            <Link
              key={article.slug}
              href={`/news/${article.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${categoryColors[article.category]}`}
                  >
                    {article.category}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {article.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {article.readTime}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-royal transition-colors group-hover:text-gold sm:text-lg">
                  {article.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-500">
                  {article.excerpt}
                </p>
                <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-royal transition-colors group-hover:text-gold">
                  Read more
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
