"use client";

import { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    q: "What is the Kufuor Scholars Program?",
    a: "A 3-year leadership development initiative that identifies and nurtures exceptional young Ghanaians through mentorship, training, and community impact projects.",
  },
  {
    q: "Who can apply?",
    a: "Ghanaian citizens aged 18–35 who are enrolled in or recently graduated from a tertiary institution in Ghana, with demonstrated leadership potential and community involvement.",
  },
  {
    q: "Is there an application fee?",
    a: "No. The Kufuor Scholars Program does not charge an application fee.",
  },
  {
    q: "What benefits do scholars receive?",
    a: "Leadership training, one-on-one mentorship, stipends, access to a pan-African network, and hands-on community impact opportunities.",
  },
];

export default function FAQ() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" className="bg-gray-50 py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            FAQ
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Quick answers to common questions about the program.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-12 max-w-3xl"
        >
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border-b border-gray-200 last:border-b-0"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-semibold text-royal">{faq.q}</span>
                <ChevronDown
                  size={20}
                  className={`flex-shrink-0 text-gold transition-transform ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === i && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pb-5 text-gray-600"
                >
                  {faq.a}
                </motion.p>
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 text-center"
        >
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 text-sm font-semibold text-royal hover:text-gold"
          >
            <HelpCircle size={16} />
            View all FAQ
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
