"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, XCircle, Clock } from "lucide-react";
import Link from "next/link";

function Countdown({ deadline }) {
  const [remaining, setRemaining] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const target = new Date(deadline);

    function tick() {
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        setRemaining(null);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setRemaining({ days, hours, mins, secs });
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!mounted || !remaining) return null;

  const passed = new Date(deadline) < new Date();
  if (passed) {
    return (
      <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/80">
        <Clock size={16} />
        Applications closed on {new Date(deadline).toLocaleDateString("en-GB", { dateStyle: "long" })}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="mt-6 flex flex-wrap items-center justify-center gap-3"
    >
      <span className="text-sm font-medium text-white/70">Applications close in</span>
      <div className="flex gap-2">
        {[
          { value: remaining.days, label: "days" },
          { value: remaining.hours, label: "hrs" },
          { value: remaining.mins, label: "min" },
          { value: remaining.secs, label: "sec" },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="flex min-w-[3rem] flex-col items-center rounded-lg border border-white/30 bg-white/10 px-3 py-2"
          >
            <span className="text-lg font-bold text-white tabular-nums">
              {String(value).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-medium uppercase text-white/60">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Hero({ applicationsOpen = false, applicationDeadline = null }) {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-royal">
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-royal-dark via-royal to-royal-light opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(200,169,81,0.15),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(200,169,81,0.1),_transparent_60%)]" />

      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-32 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold">
            The John Agyekum Kufuor Foundation
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${
              applicationsOpen
                ? "border border-green-400/50 bg-green-500/20 text-green-200"
                : "border border-white/30 bg-white/10 text-white/90"
            }`}
          >
            {applicationsOpen ? (
              <>Applications Open</>
            ) : (
              <>
                <XCircle size={14} />
                Applications Currently Closed
              </>
            )}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Grooming Future{" "}
          <span className="text-gold">Leaders of Africa</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 sm:text-xl"
        >
          A transformational 3-year program nurturing exceptional young Ghanaians
          through leadership development, mentorship, and academic excellence.
        </motion.p>

        {applicationsOpen && applicationDeadline && (
          <Countdown deadline={applicationDeadline} />
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          {applicationsOpen ? (
            <Link
              href="/register"
              className="group flex items-center gap-2 rounded-lg bg-gold px-8 py-3.5 text-sm font-semibold text-royal shadow-lg shadow-gold/20 transition-all duration-200 hover:bg-gold-light hover:shadow-xl hover:shadow-gold/30"
            >
              Apply Now
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          ) : (
            <span className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white/70">
              Applications Closed
            </span>
          )}
          <a
            href="#about"
            className="rounded-lg border border-white/20 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-white/40 hover:bg-white/5"
          >
            Learn More
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <a href="#about" className="flex flex-col items-center gap-2 text-white/40 hover:text-white/60 transition-colors">
          <span className="text-xs font-medium uppercase tracking-widest">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </motion.div>
    </section>
  );
}
