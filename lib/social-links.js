/** Public social URLs — override via env in production */
export function getSocialLinks() {
  const e = process.env;
  return {
    facebook: e.NEXT_PUBLIC_SOCIAL_FACEBOOK || "#",
    twitter: e.NEXT_PUBLIC_SOCIAL_TWITTER || "#",
    instagram: e.NEXT_PUBLIC_SOCIAL_INSTAGRAM || "#",
    youtube: e.NEXT_PUBLIC_SOCIAL_YOUTUBE || "https://www.youtube.com",
    tiktok: e.NEXT_PUBLIC_SOCIAL_TIKTOK || "#",
    linkedin: e.NEXT_PUBLIC_SOCIAL_LINKEDIN || "https://www.linkedin.com",
  };
}
