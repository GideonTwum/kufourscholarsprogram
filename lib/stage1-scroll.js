/**
 * Stage 1 wizard scroll helpers.
 * The dashboard shell scrolls `.dashboard-content`, not window/body.
 */

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll the actual Stage 1 content container to the top after a successful step change. */
export function scrollStage1ContentToTop() {
  if (typeof document === "undefined") return;
  const reduced = prefersReducedMotion();
  const behavior = reduced ? "auto" : "smooth";
  const pane = document.querySelector("main.dashboard-content");
  if (pane && typeof pane.scrollTo === "function") {
    pane.scrollTo({ top: 0, behavior });
    return;
  }
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo({ top: 0, behavior });
  }
}
