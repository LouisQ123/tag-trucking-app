import type { Profile } from "@/lib/types/database";
import SignOutButton from "./SignOutButton";
import NavLinks from "./NavLinks";

export default function TopBar({ profile }: { profile: Profile }) {
  return (
    <div className="sticky top-0 z-20">
      <div className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-ink text-accent flex items-center justify-center font-extrabold text-[13px] flex-none">
                ATG
              </div>
              <div className="leading-tight">
                <p className="font-extrabold text-[15px]">ATG Trucking LLC</p>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-muted">
                  {profile.role === "admin" ? "Admin" : "Driver Production"}
                </p>
              </div>
            </div>
            <div className="sm:hidden">
              <SignOutButton />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <NavLinks role={profile.role} />
            <div className="hidden sm:block">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
      <div className="hazard-rule" aria-hidden="true" />
    </div>
  );
}
