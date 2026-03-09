import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";

export const metadata = {
  title: "Events | Kufuor Scholars Program",
  description:
    "Upcoming leadership events, summits, and seminars from the Kufuor Scholars Program.",
};

function formatEventDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function EventsPage() {
  let events = [];
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("events")
      .select("id, title, slug, description, event_date, event_time, location")
      .gte("event_date", today)
      .order("event_date", { ascending: true });
    events = data || [];
  } catch {}

  const placeholderEvents = [
    { id: "1", title: "Leadership Summit 2026", event_date: "2026-03-15", event_time: "9:00 AM", location: "Accra, Ghana", description: "Annual gathering of scholars, alumni, and partners to discuss leadership in Africa." },
    { id: "2", title: "Mentorship Bootcamp", event_date: "2026-04-10", event_time: "2:00 PM", location: "Virtual", description: "Intensive mentorship training for new scholar cohorts." },
    { id: "3", title: "Community Impact Showcase", event_date: "2026-05-20", event_time: "10:00 AM", location: "Kumasi", description: "Scholars present their community projects and impact metrics." },
  ];

  const displayEvents = events.length > 0 ? events : placeholderEvents;

  return (
    <div className="pt-24">
      <div className="bg-royal">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-gold"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Leadership Events
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Summits, camps, seminars, and gatherings that build the next
            generation of African leaders.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {displayEvents.map((event) => (
            <div
              key={event.id}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-royal/10 text-royal">
                <Calendar size={24} />
              </div>
              <h2 className="mt-4 text-xl font-bold text-royal">
                {event.title}
              </h2>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
