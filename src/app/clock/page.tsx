import Link from "next/link";
import Logo from "@/components/Logo";
import { getClockNames } from "@/lib/actions/clock";
import ClockForm from "./ClockForm";

// Public — no sign-in. It only ever clocks in/out; nothing from the
// dashboard is reachable from here.
export const dynamic = "force-dynamic";

export default async function ClockPage() {
  const names = await getClockNames();

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-ink text-accent flex items-center justify-center">
            <Logo className="w-8 h-7" />
          </div>
          <div className="text-center">
            <p className="font-extrabold text-lg tracking-tight">ATG Trucking LLC</p>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted">Time Clock</p>
          </div>
        </div>
        <ClockForm names={names} />
        <p className="text-center mt-6">
          <Link href="/login" className="text-xs font-bold text-ink-2 hover:text-ink">
            Admin sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
