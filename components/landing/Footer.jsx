"use client";

import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

const quickLinks = [
  { label: "About", href: "#about" },
  { label: "Program", href: "#highlights" },
  { label: "Gallery", href: "#gallery" },
  { label: "Contact", href: "#contact" },
];

const programLinks = [
  { label: "Apply Now", href: "#" },
  { label: "Scholar Login", href: "#" },
  { label: "Mentorship", href: "#highlights" },
  { label: "Community Service", href: "#highlights" },
];

const socials = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
];

export default function Footer() {
  return (
    <footer className="bg-royal-dark">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold text-royal font-bold text-lg">
                KS
              </div>
              <span className="text-lg font-bold text-white">
                Kufuor Scholars
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              An initiative of the John Agyekum Kufuor Foundation, grooming
              the next generation of African leaders.
            </p>
            <div className="mt-6 flex gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/50 transition-colors hover:bg-gold/20 hover:text-gold"
                  aria-label={social.label}
                >
                  <social.icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-3">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Program Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Program
            </h3>
            <ul className="mt-4 space-y-3">
              {programLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-white/50 transition-colors hover:text-gold"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter / CTA */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Stay Updated
            </h3>
            <p className="mt-4 text-sm text-white/50">
              Get the latest news about the program and application deadlines.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="email"
                placeholder="Your email"
                className="w-full rounded-lg bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-gold/50"
              />
              <button className="whitespace-nowrap rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-royal transition-colors hover:bg-gold-light">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-white/40">
              &copy; 2026 John Agyekum Kufuor Foundation.
              All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-xs text-white/40 hover:text-white/60">
                Privacy Policy
              </a>
              <a href="#" className="text-xs text-white/40 hover:text-white/60">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
