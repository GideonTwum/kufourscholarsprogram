import { categoryColors } from "./news-data";

export { categoryColors };

export function formatArticle(row) {
  if (!row) return null;
  const publishedAt = row.published_at ? new Date(row.published_at) : null;
  return {
    slug: row.slug,
    category: row.category || "Program",
    title: row.title,
    excerpt: row.excerpt || "",
    body: row.body || "",
    image: row.image || "/scholars14.jpg",
    featured: !!row.featured,
    date: publishedAt
      ? publishedAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "",
    readTime: row.read_time || "3 min read",
  };
}

export function getCategoryColor(category) {
  return categoryColors[category] || "bg-gray-100 text-gray-700";
}
