/**
 * Official KSP public social profiles (footer + contact “Follow Us”).
 * Single source of truth — do not hardcode these URLs in components.
 *
 * Env vars (NEXT_PUBLIC_SOCIAL_*) override the defaults when set.
 *
 * Handles (Stage 1 follow evidence uses Instagram/TikTok/LinkedIn):
 * - Instagram: @kufuor_scholars_program
 * - TikTok:    @kufuorscholars
 * - LinkedIn:  Kufuor Scholars Program
 */

/** Official operator-supplied profile URLs. */
export const KSP_SOCIAL_PROFILE_URLS = {
  instagram:
    "https://www.instagram.com/kufuor_scholars_program?igsi=MW00OGNzMTc5ZmJ5OQ==",
  tiktok: "https://www.tiktok.com/@kufuorscholars?_r=1&_t=ZS-993WQyXTkbx",
  linkedin: "https://www.linkedin.com/company/kufuor-scholars-program/",
  youtube: "https://www.youtube.com/results?search_query=%40kufuorscholars",
};

/**
 * Resolved URLs for Instagram → TikTok → LinkedIn → YouTube.
 * Facebook and X/Twitter are intentionally omitted.
 */
export function getSocialLinks() {
  const e = process.env;
  return {
    instagram: (e.NEXT_PUBLIC_SOCIAL_INSTAGRAM || KSP_SOCIAL_PROFILE_URLS.instagram).trim(),
    tiktok: (e.NEXT_PUBLIC_SOCIAL_TIKTOK || KSP_SOCIAL_PROFILE_URLS.tiktok).trim(),
    linkedin: (e.NEXT_PUBLIC_SOCIAL_LINKEDIN || KSP_SOCIAL_PROFILE_URLS.linkedin).trim(),
    youtube: (e.NEXT_PUBLIC_SOCIAL_YOUTUBE || KSP_SOCIAL_PROFILE_URLS.youtube).trim(),
  };
}

/** Ordered platform keys for footer / contact social rows. */
export const KSP_PUBLIC_SOCIAL_PLATFORMS = ["instagram", "tiktok", "linkedin", "youtube"];
