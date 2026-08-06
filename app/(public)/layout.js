import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import StaffApplyNotice from "@/components/landing/StaffApplyNotice";

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
      <Suspense fallback={null}>
        <StaffApplyNotice />
      </Suspense>
      <Navbar applicationsOpen={applicationsOpen} />
      {children}
      <Footer applicationsOpen={applicationsOpen} />
    </div>
  );
}
