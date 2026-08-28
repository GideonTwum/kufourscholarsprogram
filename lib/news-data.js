/**
 * News UI helpers only.
 *
 * IMPORTANT: Do not use fabricated articles as a production fallback.
 * Public news comes exclusively from public.news_articles via Director CMS.
 * Historical demo article content lived here and in supabase-migration-news.sql —
 * those must not be shown when the database has no legitimate published articles.
 */

export const categoryColors = {
  Admissions: "bg-gold/10 text-gold-dark",
  Events: "bg-royal/10 text-royal",
  Alumni: "bg-emerald-50 text-emerald-700",
  Program: "bg-amber-50 text-amber-700",
};

/** @deprecated Empty by design — public pages must not fall back to demo news. */
export const articles = [];
