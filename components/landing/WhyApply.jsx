"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, GraduationCap, Handshake, Network, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

const reasons = [
  {
    icon: GraduationCap,
    title: "Grow as a leader",
    description:
      "Develop discipline, public service values, communication, and practical leadership habits over a structured multi-year experience.",
  },
  {
    icon: Handshake,
    title: "Learn from mentors",
    description:
      "Connect with experienced leaders, professionals, and alumni who can sharpen your judgment and widen your options.",
  },
  {
    icon: Network,
    title: "Join a serious network",
    description:
      "Become part of a community of scholars committed to excellence, service, and Africa-focused problem solving.",
  },
  {
    icon: Sparkles,
    title: "Build real impact",
    description:
      "Turn academic promise into community contribution through projects, exposure, and accountable development.",
  },
];

export default function WhyApply({ applicationsOpen = false }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="why-apply" className="bg-gray-50 py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Why Apply?
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            More than a scholarship application
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-gray-600">
            The Kufuor Scholars Program is built for students who want to be
            tested, mentored, and prepared for responsible leadership.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal/5 text-royal">
                <reason.icon size={24} />
              </div>
              <h3 className="mt-5 font-bold text-gray-900">{reason.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {reason.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href={applicationsOpen ? "/applicant-register" : "/apply"}
            className="inline-flex items-center gap-2 rounded-lg bg-royal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-royal/90"
          >
            {applicationsOpen ? "Start your application" : "Prepare to apply"}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
