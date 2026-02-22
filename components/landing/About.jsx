"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Shield, Flag, Eye, Scale } from "lucide-react";
import Image from "next/image";

const values = [
  { icon: Shield, label: "Integrity", description: "Upholding the highest moral and ethical standards" },
  { icon: Flag, label: "Patriotism", description: "Fostering love and service to the nation" },
  { icon: Eye, label: "Transparency", description: "Promoting openness and accountability" },
  { icon: Scale, label: "Accountability", description: "Taking responsibility for impact and outcomes" },
];

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="bg-white py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              About the Program
            </span>
            <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
              Building Tomorrow&apos;s Leaders Today
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              The Kufuor Scholars Program, an initiative of the John Agyekum
              Kufuor Foundation, identifies and nurtures exceptional young
              Ghanaians with leadership potential. Through a rigorous 3-year
              program, scholars are equipped with the skills, knowledge, and
              networks needed to drive positive change across Africa.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              Founded on the legacy of President John Agyekum Kufuor, the
              program embodies the belief that investing in young leaders is
              the most impactful way to shape Africa&apos;s future.
            </p>
          </motion.div>

          {/* Image placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="aspect-[4/3] overflow-hidden rounded-2xl">
              <Image
                src="/scholars.jpg"
                alt="Kufuor Scholars Program"
                width={800}
                height={600}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl bg-gold/20" />
          </motion.div>
        </div>

        {/* Core values */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
          className="mt-20"
        >
          <h3 className="text-center text-2xl font-bold text-royal">
            Our Core Values
          </h3>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, i) => (
              <motion.div
                key={value.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                className="group rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm transition-all duration-300 hover:border-gold/30 hover:shadow-md"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-royal/5 text-royal transition-colors group-hover:bg-gold/10 group-hover:text-gold">
                  <value.icon size={24} />
                </div>
                <h4 className="mt-4 font-semibold text-royal">{value.label}</h4>
                <p className="mt-2 text-sm text-gray-500">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
