import SignOutButton from "./SignOutButton";
import NavLinks from "./NavLinks";
import MobileNav from "./MobileNav";
import Logo from "./Logo";

export default function TopBar() {
  return (
    <div className="w-full print:hidden relative">
      <div className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-ink text-accent flex items-center justify-center flex-none">
              <Logo className="w-6 h-5" />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold text-[15px]">ATG Trucking LLC</p>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-muted">Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NavLinks />
            <div className="hidden lg:block">
              <SignOutButton />
            </div>
            <MobileNav />
          </div>
        </div>
      </div>
      <div className="hazard-rule" aria-hidden="true" />
    </div>
  );
}
