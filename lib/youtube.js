const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accept watch, youtu.be, and Shorts links. Hostname must match exactly.
 * Returns the 11-character id and a canonical watch URL, or null.
 */
export function parseYoutubeVideoUrl(input) {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  let url;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  let videoId = "";
  if (host === "youtu.be") {
    videoId = parts[0] || "";
  } else if (parts[0] === "watch") {
    videoId = url.searchParams.get("v") || "";
  } else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "v") {
    videoId = parts[1] || "";
  }

  if (!VIDEO_ID.test(videoId)) return null;
  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/**
 * Parse YouTube video ID from common URL formats
 */
export function getYoutubeVideoId(url) {
  return parseYoutubeVideoUrl(url)?.videoId || null;
}

/**
 * iframe src: first N seconds only (preview), then user goes to YouTube for full video
 */
export function getYoutubeEmbedPreviewSrc(videoId, previewSeconds = 60) {
  if (!videoId) return null;
  const end = Math.max(10, Math.min(previewSeconds || 60, 600));
  return `https://www.youtube.com/embed/${videoId}?rel=0&end=${end}`;
}

/**
 * Full video on YouTube (opens in new tab)
 */
export function getYoutubeWatchUrl(videoId) {
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}
