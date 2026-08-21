import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/landing/SiteHeader";
import Footer from "@/components/landing/Footer";
import {
  DEFAULT_APPLICATION_CLASS_NAME,
  normalizeApplicationClassName,
} from "@/lib/application-class";

export default async function PublicLayout({ children }) {
  let applicationsOpen = false;
  let applicationClassName = DEFAULT_APPLICATION_CLASS_NAME;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "applications_open")
      .single();
    if (data) applicationsOpen = data.value === "true";

    const { data: classSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "application_class_name")
      .maybeSingle();
    const resolved = normalizeApplicationClassName(classSetting?.value);
    if (resolved) applicationClassName = resolved;
  } catch {}

  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteHeader
        applicationsOpen={applicationsOpen}
        applicationClassName={applicationClassName}
      />
      {children}
      <Footer applicationsOpen={applicationsOpen} />
    </div>
  );
}
