"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { NAV_LINKS, isNavLinkActive } from "./NavLinks";

// Shown below `lg` — eight nav items don't fit a phone or tablet width as a
// horizontal row, so they collapse into this hamburger-triggered panel
// instead. The panel is `absolute top-full` against TopBar's own relative
// wrapper, so it always sits flush under the header regardless of the
// header's actual height.
export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Adjusted during render (React's recommended pattern) rather than via an
  // effect, since this reacts to `pathname` — a value already produced by
  // this render — and closing in an effect would cause an extra render.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="relative z-50 w-10 h-10 rounded-lg border border-border flex items-center justify-center text-ink flex-none"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-full z-40 bg-surface border-b border-border shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const active = isNavLinkActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-2.5 rounded-md text-[14px] font-bold transition-colors ${
                      active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => signOut()}
                className="mt-2 px-3.5 py-2.5 rounded-md text-[14px] font-bold text-left text-critical border-t border-border pt-4"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
