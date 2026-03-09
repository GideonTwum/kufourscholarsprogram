import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://scholars.kufuorfoundation.org";

export default async function sitemap() {
  const staticPages = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/apply`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/scholars`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/alumni`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/projects`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/news`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/gallery`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  let dynamicPages = [];

  try {
    const supabase = await createClient();

    const { data: news } = await supabase
      .from("news_articles")
      .select("slug, updated_at")
      .order("published_at", { ascending: false });
    if (news?.length) {
      dynamicPages = dynamicPages.concat(
        news.map((a) => ({
          url: `${BASE_URL}/news/${a.slug}`,
          lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        }))
      );
    }

    const { data: projects } = await supabase
      .from("projects")
      .select("slug, created_at");
    if (projects?.length) {
      dynamicPages = dynamicPages.concat(
        projects.map((p) => ({
          url: `${BASE_URL}/projects/${p.slug}`,
          lastModified: p.created_at ? new Date(p.created_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        }))
      );
    }

    const { data: scholars } = await supabase
      .from("scholars")
      .select("slug, cohort_year, updated_at");
    if (scholars?.length) {
      dynamicPages = dynamicPages.concat(
        scholars.map((s) => ({
          url: `${BASE_URL}/scholars/${s.cohort_year}/${s.slug}`,
          lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.5,
        }))
      );
    }
  } catch {}

  return [...staticPages, ...dynamicPages];
}
