import { createClient } from "@/lib/supabase/server";
import { articles as fallbackArticles, categoryColors } from "@/lib/news-data";
import { formatArticle, getCategoryColor } from "@/lib/news";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("news_articles")
      .select("slug");
    if (data?.length) return data.map((a) => ({ slug: a.slug }));
  } catch {}
  return fallbackArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("news_articles")
      .select("title, excerpt")
      .eq("slug", slug)
      .single();
    if (data)
      return {
        title: `${data.title} | Kufuor Scholars Program`,
        description: data.excerpt,
      };
  } catch {}
  const article = fallbackArticles.find((a) => a.slug === slug);
  if (!article) return {};
  return {
    title: `${article.title} | Kufuor Scholars Program`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  let article = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .eq("slug", slug)
      .single();
    if (data) article = formatArticle(data);
  } catch {}

  if (!article) {
    article = fallbackArticles.find((a) => a.slug === slug);
  }
  if (!article) notFound();

  let otherArticles = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .neq("slug", slug)
      .order("published_at", { ascending: false })
      .limit(3);
    otherArticles = (data || []).map(formatArticle);
  } catch {}
  if (otherArticles.length === 0) {
    otherArticles = fallbackArticles
      .filter((a) => a.slug !== slug)
      .slice(0, 3);
  }

  const categoryColor = categoryColors[article.category] || getCategoryColor(article.category);

  return (
    <div className="pt-24">
      <div className="relative h-64 sm:h-80 md:h-96">
        <Image
          src={article.image}
          alt={article.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="mx-auto max-w-3xl">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${categoryColor}`}
            >
              {article.category}
            </span>
          </div>
        </div>
        <div className="absolute left-0 top-0 p-6 sm:p-10">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/50"
          >
            <ArrowLeft size={16} />
            All News
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {article.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {article.readTime}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold text-royal sm:text-4xl md:text-5xl">
          {article.title}
        </h1>

        <div className="mt-8 space-y-6">
          {(article.body || "").split("\n\n").filter(Boolean).map((paragraph, i) => (
            <p key={i} className="text-base leading-relaxed text-gray-600 sm:text-lg">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-12 border-t border-gray-100 pt-8">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 text-sm font-semibold text-royal transition-colors hover:text-gold"
          >
            <ArrowLeft size={16} />
            Back to all news
          </Link>
        </div>
      </div>

      {otherArticles.length > 0 && (
        <div className="bg-gray-50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="mb-8 text-2xl font-bold text-royal">
              More Articles
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {otherArticles.map((related) => (
                <Link
                  key={related.slug}
                  href={`/news/${related.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={related.image}
                      alt={related.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${categoryColors[related.category] || getCategoryColor(related.category)}`}
                      >
                        {related.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {related.date}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-bold text-royal transition-colors group-hover:text-gold">
                      {related.title}
                    </h3>
                    <p className="mt-2 flex-1 line-clamp-2 text-sm text-gray-500">
                      {related.excerpt}
                    </p>
                    <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-royal transition-colors group-hover:text-gold">
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
        </div>
      )}
    </div>
  );
}
