"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    quote:
      "The Kufuor Scholars Program transformed my perspective on leadership. The mentorship and exposure I received have been instrumental in shaping my career in public service.",
    name: "Ama Mensah",
    cohort: "Cohort 2018",
    role: "Policy Analyst, Ministry of Finance",
  },
  {
    quote:
      "Being a Kufuor Scholar opened doors I never knew existed. The network of alumni and mentors continues to be a valuable resource years after graduation.",
    name: "Kwame Asante",
    cohort: "Cohort 2019",
    role: "Social Entrepreneur",
  },
  {
    quote:
      "The program's emphasis on community service instilled in me a deep sense of responsibility. Today, I lead initiatives that impact thousands of young people across Ghana.",
    name: "Efua Owusu",
    cohort: "Cohort 2020",
    role: "NGO Director",
  },
  {
    quote:
      "From reading circles to mentorship with industry leaders, every aspect of the program was designed to stretch our thinking and build our capacity for leadership.",
    name: "Kofi Boateng",
    cohort: "Cohort 2021",
    role: "Technology Consultant",
  },
];

export default function Testimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setCurrent((prev) => (prev + 1) % testimonials.length);
  const prev = () =>
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  return (
    <section className="bg-gray-50 py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Hear From Our Scholars
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto mt-16 max-w-3xl"
        >
          <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm sm:p-12">
            <Quote
              size={48}
              className="absolute left-6 top-6 text-gold/15 sm:left-10 sm:top-8"
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4 }}
                className="relative"
              >
                <p className="text-lg leading-relaxed text-gray-600 italic sm:text-xl">
                  &ldquo;{testimonials[current].quote}&rdquo;
                </p>
                <div className="mt-8 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-royal text-sm font-bold text-gold">
                    {testimonials[current].name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-royal">
                      {testimonials[current].name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {testimonials[current].role} &middot;{" "}
                      {testimonials[current].cohort}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={prev}
              className="rounded-full border border-gray-200 p-2 text-gray-400 transition-colors hover:border-gold hover:text-gold"
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current
                      ? "w-8 bg-gold"
                      : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="rounded-full border border-gray-200 p-2 text-gray-400 transition-colors hover:border-gold hover:text-gold"
              aria-label="Next testimonial"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
