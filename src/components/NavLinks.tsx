"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types/database";

export default function NavLinks({ role }: { role: Role }) {
  const pathname = usePathname();
  const links =
    role === "admin"
      ? [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/drivers", label: "Drivers" },
        ]
      : [{ href: "/", label: "New Sheet" }];
  links.push({ href: "/account", label: "Account" });

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
