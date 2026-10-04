"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, XCircle } from "lucide-react";
import Link from "next/link";
import ApplyNowCta from "@/components/landing/ApplyNowCta";
import HeroBackground from "@/components/landing/HeroBackground";
import DeadlineCountdown from "@/components/DeadlineCountdown";
import {
  formatHeroBadge,
  formatSearchCampaign,
} from "@/lib/application-class";

function Countdown({ deadline }) {
  const closedDate = new Date(deadline).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    dateStyle: "long",
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <DeadlineCountdown
        deadline={deadline}
        openLabel="Applications close in"
        closedLabel={`Applications closed on ${closedDate}`}
        variant="hero"
      />
    </motion.div>
  );
}

export default function Hero({
  applicationsOpen = false,
  applicationDeadline = null,
  applicationClassName = "11th Class",
}) {
  return (
    <section className="relative flex min-h-[min(100svh,920px)] items-center overflow-hidden bg-royal-dark lg:min-h-[100svh]">
      <HeroBackground />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-10 sm:px-6 sm:pt-12 lg:px-8 lg:pb-28 lg:pt-16">
        {/* Left content column — stays over solid green; does not extend into photo */}
        <div className="w-full max-w-[42rem] text-left lg:max-w-[46rem]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mb-5 flex flex-wrap items-center gap-2.5 sm:gap-3"
          >
            <span className="inline-block rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-xs font-medium text-gold sm:px-4 sm:text-sm">
              The John A. Kufuor Foundation
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm ${
                applicationsOpen
                  ? "border border-green-400/45 bg-green-500/20 text-green-100"
                  : "border border-white/30 bg-white/10 text-white/90"
              }`}
            >
              {applicationsOpen ? null : <XCircle size={14} />}
              {formatHeroBadge(applicationClassName, applicationsOpen)}
            </span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06, ease: "easeOut" }}
            className="mb-3 text-sm font-semibold tracking-wide text-gold sm:text-base"
          >
            {formatSearchCampaign(applicationClassName)}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
            className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[4.5rem] xl:text-[4.75rem]"
          >
            <span className="block">Rewiring Future</span>
            <span className="mt-1 block text-gold sm:mt-1.5">Leaders of Africa</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: "easeOut" }}
            className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:mt-6 sm:text-lg md:text-xl"
          >
            Africans studying in Ghana — leadership development, mentorship, and academic
            excellence through a transformational multi-year fellowship.
          </motion.p>

          {applicationsOpen && applicationDeadline && (
            <Countdown deadline={applicationDeadline} />
          )}

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.36, ease: "easeOut" }}
            className="mt-8 flex max-w-3xl flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center"
          >
            {applicationsOpen ? (
              <ApplyNowCta
                applicationsOpen
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-7 py-3.5 text-sm font-semibold text-royal shadow-lg shadow-gold/20 transition-all duration-200 hover:bg-gold-light hover:shadow-xl hover:shadow-gold/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Apply Now
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </ApplyNowCta>
            ) : (
              <ApplyNowCta
                applicationsOpen={false}
                closedClassName="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              />
            )}
            <Link
              href="/scholars"
              className="group inline-flex items-center justify-center gap-2 rounded-lg border border-gold/35 bg-transparent px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-gold/55 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Meet Our Scholars
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            {applicationsOpen ? (
              <Link
                href="/apply"
                className="group inline-flex items-center justify-center gap-2 rounded-lg border border-gold/35 bg-transparent px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-gold/55 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Create an account to begin your application
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            ) : null}
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.7 }}
        className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2"
      >
        <a
          href="#about"
          className="flex flex-col items-center gap-2 text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="text-xs font-medium uppercase tracking-widest">Scroll</span>
          <ChevronDown size={20} className="motion-safe:animate-bounce" />
        </a>
      </motion.div>
    </section>
  );
}
