/**
 * Parse YouTube video ID from common URL formats
 */
export function getYoutubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const s = url.trim();
  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const embed = s.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  const shorts = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shorts) return shorts[1];
  return null;
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
