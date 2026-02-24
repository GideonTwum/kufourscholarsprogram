import { createBrowserClient } from "@supabase/ssr";

let browserClient = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your deployment environment. " +
        "Find them at: https://supabase.com/dashboard/project/_/settings/api"
    );
  }

  if (browserClient) return browserClient;
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
