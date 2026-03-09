import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export default async function PublicLayout({ children }) {
  let applicationsOpen = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "applications_open")
      .single();
    if (data) applicationsOpen = data.value === "true";
  } catch {}

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar applicationsOpen={applicationsOpen} />
      {children}
      <Footer />
    </div>
  );
}
