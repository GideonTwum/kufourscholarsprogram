import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import ProgramHighlights from "@/components/landing/ProgramHighlights";
import Stats from "@/components/landing/Stats";
import Gallery from "@/components/landing/Gallery";
import Testimonials from "@/components/landing/Testimonials";
import News from "@/components/landing/News";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";

export default async function Home() {
  let applicationsOpen = false;
  let applicationDeadline = null;
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
  } catch {
    // Table may not exist yet; default to closed
  }

  return (
    <main className="min-h-screen bg-white font-sans">
      <Navbar applicationsOpen={applicationsOpen} />
      <Hero applicationsOpen={applicationsOpen} applicationDeadline={applicationDeadline} />
      <About />
      <ProgramHighlights />
      <Stats />
      <Gallery />
      <Testimonials />
      <News />
      <Contact />
      <Footer />
    </main>
  );
}
