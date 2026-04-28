"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Play } from "lucide-react";

function embedUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const watch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  const emb = u.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (emb) return `https://www.youtube.com/embed/${emb[1]}`;
  return null;
}

export default function YoutubeSpotlights({ videos = [] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  if (!videos.length) return null;

  return (
    <section ref={ref} className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">Video</span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">Program spotlights &amp; stories</h2>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            Featured YouTube stories from the foundation and the scholar community.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v, i) => {
            const src = embedUrl(v.youtube_url);
            if (!src) return null;
            return (
              <motion.article
                key={v.id || i}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm"
              >
                <div className="aspect-video bg-royal/10">
                  <iframe
                    title={v.title || "YouTube video"}
                    src={src}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                    <Play size={12} />
                    YouTube
                  </div>
                  <h3 className="font-semibold text-royal">{v.title}</h3>
                  {v.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-gray-600">{v.description}</p>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
