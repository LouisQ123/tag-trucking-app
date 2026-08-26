"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/balances", label: "Balances" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/roster", label: "Roster" },
  { href: "/admin/team", label: "Team" },
  { href: "/account", label: "Account" },
];

export function isNavLinkActive(pathname: string, href: string): boolean {
  return href === "/" || href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex items-center gap-1 bg-surface-2 rounded-lg p-1">
      {NAV_LINKS.map((link) => {
        const active = isNavLinkActive(pathname, link.href);
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
