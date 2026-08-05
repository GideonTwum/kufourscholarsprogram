"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";

/** Tailwind w-64 — keep in sync with lg:pl-64 on the content column */
export const DASHBOARD_SIDEBAR_WIDTH_CLASS = "w-64";
export const DASHBOARD_CONTENT_OFFSET_CLASS = "lg:pl-64";

/**
 * Shared portal shell: fixed sidebar + sticky header + scrollable main.
 * Used by Director / Assessor / Panel / Applicant layouts.
 */
export default function DashboardShell({
  navItems,
  roleLabel,
  rootHref,
  profile,
  onLogout,
  headerExtra = null,
  children,
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  function isNavActive(href) {
    if (!mounted || !pathname) return false;
    if (pathname === href) return true;
    if (href === rootHref) return false;
    return pathname.startsWith(href);
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className="dashboard-shell h-dvh max-h-dvh min-h-0 overflow-hidden bg-gray-50">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="dashboard-sidebar"
        aria-labelledby={titleId}
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh ${DASHBOARD_SIDEBAR_WIDTH_CLASS} flex-col bg-white shadow-lg transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2" id={titleId}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-royal text-sm font-bold text-gold">
              KS
            </div>
            <span className="truncate text-sm font-bold text-royal">Kufuor Scholars</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Portal navigation">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isNavActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-royal/5 text-royal"
                      : "text-gray-600 hover:bg-gray-50 hover:text-royal"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0 truncate">{item.label}</span>
                  {active ? <ChevronRight size={14} className="ml-auto shrink-0 text-royal/50" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-gray-100 p-4">
          {profile ? (
            <div className="mb-3 flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-royal text-xs font-bold text-gold">
                {initials}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-gray-900">
                  {profile.full_name || roleLabel}
                </p>
                <p className="truncate text-xs text-gray-500">{roleLabel}</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} className="shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      <div
        className={`flex h-dvh max-h-dvh min-w-0 flex-col overflow-hidden ${DASHBOARD_CONTENT_OFFSET_CLASS}`}
      >
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-100 bg-white px-4 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 lg:hidden"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            aria-controls="dashboard-sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0 flex-1" />
          {headerExtra}
          <span className="shrink-0 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-dark">
            {roleLabel}
          </span>
        </header>

        <main className="dashboard-content min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto w-full min-w-0 max-w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
