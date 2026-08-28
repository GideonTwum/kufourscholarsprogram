/**
 * TEMPORARY launch-wait announcement — remove after 10:15 AM today.
 *
 * To disable instantly: set TEMPORARY_LAUNCH_WAIT_BANNER_ENABLED = false
 * To remove fully: delete this file and its import/usage in SiteHeader.jsx
 */
export const TEMPORARY_LAUNCH_WAIT_BANNER_ENABLED = true;

/**
 * Compact site-wide notice above the navbar.
 * Does not change applications_open / Apply Now business logic.
 */
export default function TemporaryLaunchWaitBanner() {
  if (!TEMPORARY_LAUNCH_WAIT_BANNER_ENABLED) return null;

  return (
    <div
      className="border-b border-gold/30 bg-royal-dark text-white"
      data-temporary-launch-wait-banner="true"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        <p className="text-center text-sm font-bold tracking-wide text-gold sm:text-base">
          Applications Open at{" "}
          <span className="inline-block rounded-sm bg-gold/15 px-1.5 py-0.5 text-base font-extrabold text-gold sm:text-lg">
            10:15 AM
          </span>
        </p>
        <p className="mx-auto mt-1 max-w-3xl text-center text-[11px] leading-snug text-white/85 sm:text-xs">
          We&apos;re making a few final preparations to ensure a smooth application experience.
          Please check back at{" "}
          <span className="font-semibold text-gold">10:15 AM</span> today to begin your
          application.
        </p>
        <p className="mt-1 text-center text-[11px] text-white/70 sm:text-xs">
          Thank you for your patience.
        </p>
      </div>
    </div>
  );
}
