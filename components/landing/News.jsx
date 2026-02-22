"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Calendar, ArrowRight, Clock, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { articles, categoryColors } from "@/lib/news-data";

export default function News() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const featured = articles.find((a) => a.featured);
  const rest = articles.filter((a) => !a.featured).slice(0, 3);

  return (
    <section id="news" className="bg-white py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center justify-between gap-4 sm:flex-row"
        >
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Latest
            </span>
            <h2 className="mt-2 text-3xl font-bold text-royal sm:text-4xl">
              News &amp; Updates
            </h2>
          </div>
          <Link
            href="/news"
            className="group flex items-center gap-2 text-sm font-semibold text-royal transition-colors hover:text-gold"
          >
            View all news
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {featured && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="row-span-3"
            >
              <Link
                href={`/news/${featured.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={featured.image}
                    alt={featured.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
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
                <div className="flex flex-1 flex-col p-6">
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
                  <h3 className="mt-3 text-xl font-bold text-royal transition-colors group-hover:text-gold sm:text-2xl">
                    {featured.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-500">
                    {featured.excerpt}
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
            </motion.div>
          )}

          <div className="flex flex-col gap-6">
            {rest.map((article, i) => (
              <motion.div
                key={article.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.25 + i * 0.1 }}
              >
                <Link
                  href={`/news/${article.slug}`}
                  className="group flex gap-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="hidden h-28 w-28 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-royal/10 to-royal/5 sm:flex">
                    <Tag size={22} className="text-royal/40" />
                  </div>
                  <div className="flex flex-1 flex-col justify-center">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${categoryColors[article.category]}`}
                      >
                        {article.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={11} />
                        {article.date}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-royal transition-colors group-hover:text-gold sm:text-base">
                      {article.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 sm:text-sm">
                      {article.excerpt}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
