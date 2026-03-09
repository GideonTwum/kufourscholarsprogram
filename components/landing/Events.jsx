"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";

const placeholderEvents = [
  { id: "1", title: "Leadership Summit 2026", event_date: "2026-03-15", event_time: "9:00 AM", location: "Accra, Ghana", description: "Annual gathering of scholars, alumni, and partners to discuss leadership in Africa." },
  { id: "2", title: "Mentorship Bootcamp", event_date: "2026-04-10", event_time: "2:00 PM", location: "Virtual", description: "Intensive mentorship training for new scholar cohorts." },
  { id: "3", title: "Community Impact Showcase", event_date: "2026-05-20", event_time: "10:00 AM", location: "Kumasi", description: "Scholars present their community projects and impact metrics." },
];

function formatEventDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function Events({ events: fetchedEvents = [] }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const events = fetchedEvents.length > 0 ? fetchedEvents : placeholderEvents;

  return (
    <section id="events" className="bg-white py-24">
      <div ref={ref} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center justify-between gap-4 sm:flex-row"
        >
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-gold">
              Upcoming
            </span>
            <h2 className="mt-2 text-3xl font-bold text-royal sm:text-4xl">
              Leadership Events
            </h2>
          </div>
          <Link
            href="/events"
            className="group flex items-center gap-2 text-sm font-semibold text-royal transition-colors hover:text-gold"
          >
            View all events
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal/10 text-royal transition-colors group-hover:bg-gold/20 group-hover:text-gold">
                <Calendar size={24} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-royal">
                {event.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600">{event.description}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatEventDate(event.event_date)}{event.event_time ? ` · ${event.event_time}` : ""}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {event.location}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
