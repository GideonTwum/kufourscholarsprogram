"use client";

import { useState, useEffect, useRef, useId } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  publicNavigation,
  isNavHrefActive,
  isNavItemActive,
} from "@/lib/public-navigation";
import ApplyNowCta from "@/components/landing/ApplyNowCta";

function linkTone(scrolled, active) {
  if (active) return scrolled ? "text-royal" : "text-gold";
  return scrolled
    ? "text-gray-700 hover:text-royal"
    : "text-white/90 hover:text-gold";
}

function NavDropdown({ item, scrolled, open, onToggle, onClose }) {
  const pathname = usePathname();
  const panelId = useId();
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const parentActive = isNavItemActive(pathname, item);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }

    function onPointerDown(e) {
      const t = e.target;
      if (
        panelRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onClose]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={onToggle}
        className={`inline-flex items-center gap-1 rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ${
          scrolled ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-royal"
        } ${linkTone(scrolled, parentActive || open)}`}
      >
        {item.label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={item.label}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            className="absolute left-0 top-full z-50 mt-3 min-w-[12.5rem] rounded-xl border border-gray-100 bg-white py-2 shadow-lg"
          >
            {item.children.map((child) => {
              const active = isNavHrefActive(pathname, child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  role="menuitem"
                  onClick={onClose}
                  className={`block px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:bg-royal/5 ${
                    active
                      ? "bg-royal/5 font-semibold text-royal"
                      : "font-medium text-gray-700 hover:bg-gray-50 hover:text-royal"
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileAccordion({ item, open, onToggle, onNavigate }) {
  const pathname = usePathname();
  const panelId = useId();
  const parentActive = isNavItemActive(pathname, item);

  return (
    <div className="rounded-lg">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
          parentActive ? "text-royal" : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        {item.label}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={panelId} className="mb-1 ml-2 space-y-0.5 border-l border-gray-100 pl-3">
          {item.children.map((child) => {
            const active = isNavHrefActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={`block rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  active
                    ? "font-semibold text-royal"
                    : "font-medium text-gray-600 hover:bg-gray-50 hover:text-royal"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Navbar({ applicationsOpen = false }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openMobileGroup, setOpenMobileGroup] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted]);

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
    setOpenMobileGroup(null);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const logoTextClass = scrolled ? "text-royal" : "text-white";

  if (!mounted) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent" aria-hidden="true">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal text-sm font-bold text-gold">
              KS
            </div>
            <span className="text-base font-bold text-white sm:text-lg">Kufuor Scholars</span>
          </div>
          <div className="h-9 w-24 rounded-lg bg-white/10" />
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 shadow-md backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal text-sm font-bold text-gold">
            KS
          </div>
          <span className={`truncate text-base font-bold transition-colors duration-300 sm:text-lg ${logoTextClass}`}>
            Kufuor Scholars
          </span>
        </Link>

        {/* Desktop — lg+ to keep a single calm row at 1024–1366 */}
        <div className="hidden items-center gap-5 xl:gap-6 lg:flex">
          {publicNavigation.map((item) => {
            if (item.children) {
              return (
                <NavDropdown
                  key={item.label}
                  item={item}
                  scrolled={scrolled}
                  open={openDropdown === item.label}
                  onToggle={() =>
                    setOpenDropdown((prev) => (prev === item.label ? null : item.label))
                  }
                  onClose={() => setOpenDropdown(null)}
                />
              );
            }

            const active = isNavItemActive(pathname, item);
            const className = `rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 ${
              scrolled ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-royal"
            } ${linkTone(scrolled, active)}`;

            if (item.href.startsWith("/#") || item.href.startsWith("#")) {
              return (
                <a key={item.label} href={item.href} className={className}>
                  {item.label}
                </a>
              );
            }

            return (
              <Link key={item.label} href={item.href} className={className}>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 xl:gap-3 lg:flex">
          <Link
            href="/login"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              scrolled ? "text-royal hover:text-gold" : "text-white/90 hover:text-gold"
            }`}
          >
            Login
          </Link>
          {applicationsOpen ? (
            <ApplyNowCta
              applicationsOpen
              className="whitespace-nowrap rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-royal transition-all duration-200 hover:bg-gold-light hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal"
            />
          ) : (
            <ApplyNowCta
              applicationsOpen={false}
              closedClassName="cursor-not-allowed whitespace-nowrap rounded-lg border border-gray-300/80 bg-gray-100 px-3.5 py-2 text-sm font-medium text-gray-400"
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className={`rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:hidden ${
            scrolled ? "text-royal" : "text-white"
          }`}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="overflow-hidden border-t border-gray-100 bg-white shadow-lg lg:hidden"
          >
            <div className="space-y-0.5 px-4 pb-5 pt-3">
              {publicNavigation.map((item) => {
                if (item.children) {
                  return (
                    <MobileAccordion
                      key={item.label}
                      item={item}
                      open={openMobileGroup === item.label}
                      onToggle={() =>
                        setOpenMobileGroup((prev) =>
                          prev === item.label ? null : item.label
                        )
                      }
                      onNavigate={() => setMobileOpen(false)}
                    />
                  );
                }

                const active = isNavItemActive(pathname, item);
                const className = `block rounded-lg px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  active
                    ? "font-semibold text-royal"
                    : "font-medium text-gray-700 hover:bg-gray-50 hover:text-royal"
                }`;

                if (item.href.startsWith("/#") || item.href.startsWith("#")) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={className}
                    >
                      {item.label}
                    </a>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={className}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-royal hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Login
                </Link>
                {applicationsOpen ? (
                  <ApplyNowCta
                    applicationsOpen
                    onNavigate={() => setMobileOpen(false)}
                    className="rounded-lg bg-gold px-3 py-2.5 text-center text-sm font-semibold text-royal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal"
                  />
                ) : (
                  <ApplyNowCta
                    applicationsOpen={false}
                    closedClassName="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm font-medium text-gray-500"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
