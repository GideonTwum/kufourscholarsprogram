"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import Link from "next/link";

const placeholderScholars = [
  { id: "1", full_name: "Ama Serwaa", university: "University of Ghana", field_of_study: "Law & Governance", quote: "The program transformed my perspective on leadership. I now see my role in building a better Africa." },
  { id: "2", full_name: "Kwame Asante", university: "KNUST", field_of_study: "Engineering & Innovation", quote: "The mentorship and network I gained here opened doors I never imagined possible." },
  { id: "3", full_name: "Efua Mensah", university: "University of Cape Coast", field_of_study: "Public Health", quote: "Community impact projects taught me that leadership is about serving others first." },
];

export default function ScholarSpotlight({ scholars: fetchedScholars = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const scholars = fetchedScholars.length > 0 ? fetchedScholars : placeholderScholars;

  useEffect(() => {
    if (scholars.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % scholars.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [scholars.length]);

  return (
    <section id="scholars" className="bg-gray-50 py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Scholar Spotlight
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Meet Our Scholars
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Exceptional young leaders shaping the future of Ghana and Africa.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mt-16"
        >
          <div className="mx-auto max-w-4xl">
            <AnimatePresence mode="wait">
              {scholars.map(
                (scholar, i) =>
                  i === activeIndex && (
                    <motion.div
                      key={scholar.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="overflow-hidden rounded-2xl bg-white p-8 shadow-lg sm:p-12"
                    >
                      <div className="flex flex-col items-center gap-8 md:flex-row">
                        <div className="flex-shrink-0">
                          <div className="relative h-40 w-40 overflow-hidden rounded-full bg-gradient-to-br from-royal/20 to-gold/20">
                            <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-royal/40">
                              {(scholar.full_name || "?").charAt(0)}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                          <Quote size={28} className="mx-auto mb-4 text-gold/40 md:mx-0" />
                          <p className="text-lg leading-relaxed text-gray-700 italic">
                            &ldquo;{scholar.quote || "An exceptional leader."}&rdquo;
                          </p>
                          <div className="mt-6">
                            <p className="font-bold text-royal">{scholar.full_name}</p>
                            <p className="text-sm text-gray-500">
                              {[scholar.university, scholar.field_of_study].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
              )}
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={() =>
                  setActiveIndex(
                    (prev) => (prev - 1 + scholars.length) % scholars.length
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gold hover:bg-gold/5 hover:text-royal"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2">
                {scholars.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === activeIndex
                        ? "w-8 bg-royal"
                        : "w-2 bg-gray-200 hover:bg-gray-300"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() =>
                  setActiveIndex((prev) => (prev + 1) % scholars.length)
                }
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-gold hover:bg-gold/5 hover:text-royal"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/scholars"
              className="inline-flex items-center gap-2 rounded-lg bg-royal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-royal/90"
            >
              View All Scholars
              <ChevronRight size={16} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
