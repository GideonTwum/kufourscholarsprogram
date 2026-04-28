const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://scholars.kufuorfoundation.org";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/applicant/", "/director/", "/panel/", "/login", "/director-login", "/register", "/applicant-register", "/director/signup", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
