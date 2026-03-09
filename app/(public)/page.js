import { createClient } from "@/lib/supabase/server";
import { articles as fallbackArticles } from "@/lib/news-data";
import { formatArticle } from "@/lib/news";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import ProgramHighlights from "@/components/landing/ProgramHighlights";
import Stats from "@/components/landing/Stats";
import ScholarSpotlight from "@/components/landing/ScholarSpotlight";
import Gallery from "@/components/landing/Gallery";
import Testimonials from "@/components/landing/Testimonials";
import News from "@/components/landing/News";
import FAQ from "@/components/landing/FAQ";
import Events from "@/components/landing/Events";
import Contact from "@/components/landing/Contact";

export default async function Home() {
  let applicationsOpen = false;
  let applicationDeadline = null;
  let featuredScholars = [];
  let upcomingEvents = [];
  let newsArticles = [];

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

    const { data: news } = await supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(4);
    newsArticles = (news || []).map(formatArticle);
  } catch {}

  if (newsArticles.length === 0) newsArticles = fallbackArticles.slice(0, 4);

  return (
    <main>
      <Hero applicationsOpen={applicationsOpen} applicationDeadline={applicationDeadline} />
      <About />
      <ProgramHighlights />
      <Stats />
      <ScholarSpotlight scholars={featuredScholars} />
      <Gallery />
      <Testimonials />
      <News articles={newsArticles} />
      <Events events={upcomingEvents} />
      <FAQ />
      <Contact />
    </main>
  );
}
