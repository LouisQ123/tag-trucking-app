"use client";

import { signOut } from "@/lib/actions/auth";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="text-[12.5px] font-bold text-ink-2 hover:text-critical border border-border rounded-md px-3 py-1.5"
    >
      Sign Out
    </button>
  );
}
