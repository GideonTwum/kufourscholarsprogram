"use client";

import Image from "next/image";

/**
 * Real Kufuor Scholars group photograph.
 * Decorative only — never use AI-generated design comps as runtime assets.
 */
export const HERO_PHOTO = {
  src: "/hero/scholars-formal-1.png",
  /** Keep seated leaders + scholars visible in the right panel crop */
  objectPosition: "55% 38%",
};

/**
 * Static hero scenery:
 * solid KSP green left → seamless blend → real photo right (desktop).
 * No slideshow / timers. All layers are pointer-events-none.
 */
export default function HeroBackground() {
  const { src, objectPosition } = HERO_PHOTO;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Solid green base — left panel remains true KSP green */}
      <div className="pointer-events-none absolute inset-0 bg-royal-dark" />

      {/*
        Single photo layer:
        - mobile: full-bleed under heavy overlay
        - md+: right panel ~52–58% so headline sits on solid green
      */}
      <div className="pointer-events-none absolute inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[52%] lg:w-[58%]">
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 58vw, (min-width: 768px) 52vw, 100vw"
          quality={75}
          className="object-cover"
          style={{ objectPosition }}
        />
        {/* Light brand tint — faces stay clear */}
        <div className="pointer-events-none absolute inset-0 bg-royal/15" />
        {/* Photo-edge blend into green (no hard vertical cut) */}
        <div
          className="pointer-events-none absolute inset-0 hidden md:block"
          style={{
            background: `
              linear-gradient(
                90deg,
                rgba(12, 59, 31, 1) 0%,
                rgba(12, 59, 31, 0.97) 14%,
                rgba(12, 59, 31, 0.85) 28%,
                rgba(20, 83, 45, 0.55) 48%,
                rgba(20, 83, 45, 0.22) 68%,
                rgba(20, 83, 45, 0.06) 100%
              )
            `,
          }}
        />
        {/* Tablet: slightly stronger mid overlay */}
        <div
          className="pointer-events-none absolute inset-0 hidden md:block lg:hidden"
          style={{
            background:
              "linear-gradient(90deg, rgba(12, 59, 31, 0.5) 0%, rgba(12, 59, 31, 0.18) 50%, rgba(12, 59, 31, 0.06) 100%)",
          }}
        />
        {/* Mobile readability overlay */}
        <div
          className="pointer-events-none absolute inset-0 md:hidden"
          style={{
            background: `
              linear-gradient(
                180deg,
                rgba(12, 59, 31, 0.88) 0%,
                rgba(12, 59, 31, 0.92) 45%,
                rgba(12, 59, 31, 0.97) 100%
              ),
              linear-gradient(
                90deg,
                rgba(12, 59, 31, 0.92) 0%,
                rgba(12, 59, 31, 0.7) 55%,
                rgba(12, 59, 31, 0.45) 100%
              )
            `,
          }}
        />
      </div>

      {/* Extra left solid reinforcement so content zone stays green */}
      <div
        className="pointer-events-none absolute inset-0 hidden md:block"
        style={{
          background: `
            linear-gradient(
              90deg,
              rgba(12, 59, 31, 1) 0%,
              rgba(12, 59, 31, 1) 34%,
              rgba(12, 59, 31, 0.92) 42%,
              rgba(12, 59, 31, 0) 56%
            )
          `,
        }}
      />

      {/* Dotted texture — green side only */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "40px 40px",
          maskImage:
            "linear-gradient(90deg, #000 0%, #000 36%, rgba(0,0,0,0.35) 46%, transparent 58%)",
          WebkitMaskImage:
            "linear-gradient(90deg, #000 0%, #000 36%, rgba(0,0,0,0.35) 46%, transparent 58%)",
        }}
      />

      {/* Soft gold depth in headline zone */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_48%,_rgba(200,169,81,0.09),_transparent_40%)]" />

      {/* Light top fade for transparent navbar over the photo */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background:
            "linear-gradient(180deg, rgba(12, 59, 31, 0.55) 0%, rgba(12, 59, 31, 0.2) 55%, transparent 100%)",
        }}
      />
    </div>
  );
}
