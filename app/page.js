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

export default function Home() {
  return (
    <main className="min-h-screen bg-white font-sans">
      <Navbar />
      <Hero />
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
