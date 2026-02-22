"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Crown, Users, GraduationCap, Heart } from "lucide-react";

const highlights = [
  {
    icon: Crown,
    title: "Leadership Development",
    description:
      "Intensive leadership training with real-world projects, public speaking, and strategic thinking workshops that prepare scholars for executive roles.",
  },
  {
    icon: Users,
    title: "Mentorship",
    description:
      "One-on-one mentorship from industry leaders, former presidents, diplomats, and accomplished professionals across diverse sectors.",
  },
  {
    icon: GraduationCap,
    title: "Academic Excellence",
    description:
      "Access to curated reading materials, research opportunities, and academic support to excel at top universities in Ghana and beyond.",
  },
  {
    icon: Heart,
    title: "Community Service",
    description:
      "Hands-on community engagement projects that instill a deep sense of social responsibility and nation-building commitment.",
  },
];

export default function ProgramHighlights() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="highlights" className="bg-gray-50 py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            What We Offer
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Program Pillars
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Our comprehensive 3-year program is built on four foundational
            pillars designed to create well-rounded leaders.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gold/5 transition-transform duration-300 group-hover:scale-150" />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-royal text-gold transition-colors duration-300 group-hover:bg-gold group-hover:text-royal">
                  <item.icon size={28} />
                </div>
                <h3 className="mt-6 text-lg font-bold text-royal">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
