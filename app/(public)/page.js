import { createClient } from "@/lib/supabase/server";
import Hero from "@/components/landing/Hero";
import WhyApply from "@/components/landing/WhyApply";
import About from "@/components/landing/About";
import ProgramHighlights from "@/components/landing/ProgramHighlights";
import Stats from "@/components/landing/Stats";
import ScholarSpotlight from "@/components/landing/ScholarSpotlight";
import ScholarVideos from "@/components/landing/ScholarVideos";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import YoutubeSpotlights from "@/components/landing/YoutubeSpotlights";
import Events from "@/components/landing/Events";
import Contact from "@/components/landing/Contact";
import {
  DEFAULT_APPLICATION_CLASS_NAME,
  normalizeApplicationClassName,
} from "@/lib/application-class";

export const metadata = {
  title: "Kufuor Scholars Program",
  description:
    "Applications for the Kufuor Scholars Program 11th Class — leadership development for Africans studying in Ghana.",
};

export default async function Home() {
  let applicationsOpen = false;
  let applicationDeadline = null;
  let applicationClassName = DEFAULT_APPLICATION_CLASS_NAME;
  let featuredScholars = [];
  let upcomingEvents = [];
  let scholarVideos = [];
  let youtubeSpotlights = [];

  try {
    const supabase = await createClient();
    const { data: openSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "applications_open")
      .single();
    if (openSetting) applicationsOpen = openSetting.value === "true";

    const { data: deadlineSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "application_deadline")
      .single();
    if (deadlineSetting?.value) {
      const d = new Date(deadlineSetting.value);
      if (!isNaN(d.getTime())) applicationDeadline = deadlineSetting.value;
    }

    const { data: classSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "application_class_name")
      .maybeSingle();
    const resolved = normalizeApplicationClassName(classSetting?.value);
    if (resolved) applicationClassName = resolved;

    const { data: scholars } = await supabase
      .from("scholars")
      .select("id, full_name, university, field_of_study, quote, photo_url")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(6);
    featuredScholars = scholars || [];

    const today = new Date().toISOString().slice(0, 10);
    const { data: events } = await supabase
      .from("events")
      .select("id, title, slug, description, event_date, event_time, location")
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(3);
    upcomingEvents = events || [];

    const { data: spot } = await supabase
      .from("youtube_spotlights")
      .select("*")
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .limit(6);
    youtubeSpotlights = spot || [];

    const { data: sv } = await supabase
      .from("scholar_videos")
      .select("*")
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .limit(6);
    scholarVideos = sv || [];
  } catch {}

  return (
    <main>
      <Hero
        applicationsOpen={applicationsOpen}
        applicationDeadline={applicationDeadline}
        applicationClassName={applicationClassName}
      />
      <WhyApply applicationsOpen={applicationsOpen} applicationClassName={applicationClassName} />
      <About />
      <ProgramHighlights />
      <Stats />
      <ScholarSpotlight scholars={featuredScholars} />
      <ScholarVideos videos={scholarVideos} />
      <YoutubeSpotlights videos={youtubeSpotlights} />
      <Testimonials />
      <Events events={upcomingEvents} />
      <FAQ />
      <Contact />
    </main>
  );
}
