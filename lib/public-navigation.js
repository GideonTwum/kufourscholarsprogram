/**
 * Public site navigation — shared by the landing navbar.
 * Keep hrefs aligned with real app/(public) routes only.
 */

export const publicNavigation = [
  { label: "About", href: "/about" },
  { label: "Apply", href: "/apply" },
  { label: "Scholars", href: "/scholars" },
  {
    label: "Community",
    children: [
      { label: "Mentors & Team", href: "/teams" },
      { label: "Alumni", href: "/alumni" },
    ],
  },
  {
    label: "Explore",
    children: [
      { label: "Projects", href: "/projects" },
      { label: "Events", href: "/events" },
    ],
  },
  { label: "News", href: "/news" },
  { label: "Contact", href: "/#contact" },
];

export function isNavHrefActive(pathname, href) {
  if (!pathname || !href) return false;
  if (href.startsWith("/#") || href.startsWith("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname, item) {
  if (item.href) return isNavHrefActive(pathname, item.href);
  if (item.children?.length) {
    return item.children.some((child) => isNavHrefActive(pathname, child.href));
  }
  return false;
}
