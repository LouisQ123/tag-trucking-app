"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/roster", label: "Roster" },
    { href: "/admin/team", label: "Team" },
    { href: "/account", label: "Account" },
  ];

  return (
    <nav className="flex items-center gap-1 bg-surface-2 rounded-lg p-1">
      {links.map((link) => {
        const active =
          link.href === "/" || link.href === "/admin"
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3.5 py-1.5 rounded-md text-[13.5px] font-bold transition-colors ${
              active ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
