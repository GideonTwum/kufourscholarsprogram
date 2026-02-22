"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
} from "lucide-react";

const contactInfo = [
  {
    icon: MapPin,
    title: "Address",
    lines: ["No. 9, Sixth Circular Road", "Cantonments, Accra, Ghana"],
  },
  {
    icon: Phone,
    title: "Phone",
    lines: ["+233 (0) 302 773 028", "+233 (0) 244 000 000"],
  },
  {
    icon: Mail,
    title: "Email",
    lines: ["scholars@kufuorfoundation.org", "info@kufuorfoundation.org"],
  },
  {
    icon: Clock,
    title: "Office Hours",
    lines: ["Monday – Friday", "9:00 AM – 5:00 PM"],
  },
];

const socials = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

export default function Contact() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="contact" className="bg-white py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-gold">
            Get in Touch
          </span>
          <h2 className="mt-3 text-3xl font-bold text-royal sm:text-4xl">
            Contact Us
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Have questions about the Kufuor Scholars Program? We&apos;d love to
            hear from you.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {contactInfo.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-royal/5 text-royal">
                <item.icon size={22} />
              </div>
              <h3 className="mt-4 font-semibold text-royal">{item.title}</h3>
              {item.lines.map((line, j) => (
                <p key={j} className="mt-1 text-sm text-gray-500">
                  {line}
                </p>
              ))}
            </motion.div>
          ))}
        </div>

        {/* Map placeholder + social links */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-12 grid gap-8 lg:grid-cols-3"
        >
          <div className="lg:col-span-2 overflow-hidden rounded-2xl">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3970.9731!2d-0.1825!3d5.5710!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfdf9a5a5e9c8b7d%3A0x0!2sNo.%209%2C%20Sixth%20Circular%20Road%2C%20Cantonments%2C%20Accra%2C%20Ghana!5e0!3m2!1sen!2sgh!4v1700000000000"
              width="100%"
              height="320"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="John Agyekum Kufuor Foundation Location"
              className="h-64 w-full sm:h-80"
            />
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl bg-royal p-8 text-center">
            <h3 className="text-lg font-bold text-white">Follow Us</h3>
            <p className="mt-2 text-sm text-white/60">
              Stay connected with the latest updates
            </p>
            <div className="mt-6 flex gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-gold hover:text-royal"
                  aria-label={social.label}
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
