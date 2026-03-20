"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Youtube, ExternalLink, User } from "lucide-react";
import {
  getYoutubeVideoId,
  getYoutubeEmbedPreviewSrc,
  getYoutubeWatchUrl,
} from "@/lib/youtube";

export default function ScholarVideos({ videos = [] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const valid = videos
    .map((v) => {
      const id = getYoutubeVideoId(v.youtube_url);
      return id ? { ...v, videoId: id } : null;
    })
    .filter(Boolean);

  if (valid.length === 0) return null;

  return (
    <section id="scholar-videos" className="bg-gray-50 py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            From Our Scholars
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Scholar Video Stories
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Watch a short preview on our site, then continue the full story on YouTube.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-10 md:grid-cols-2">
          {valid.map((item, i) => {
            const previewSec = item.preview_seconds ?? 60;
            const embedSrc = getYoutubeEmbedPreviewSrc(item.videoId, previewSec);
            const watchUrl = getYoutubeWatchUrl(item.videoId);
            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.1 * i }}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  <iframe
                    title={item.title}
                    src={embedSrc}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-royal">{item.title}</h3>
                      {item.scholar_name && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                          <User size={14} className="shrink-0 text-gold" />
                          {item.scholar_name}
                        </p>
                      )}
                    </div>
                    <Youtube className="shrink-0 text-red-600" size={28} aria-hidden />
                  </div>
                  {item.description && (
                    <p className="mt-3 text-sm leading-relaxed text-gray-600 line-clamp-3">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-gray-400">
                    Preview: first {previewSec} seconds. For the full video, open on YouTube.
                  </p>
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal/90"
                  >
                    <ExternalLink size={16} />
                    Watch full video on YouTube
                  </a>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
