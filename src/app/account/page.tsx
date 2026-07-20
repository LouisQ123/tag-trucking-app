import { requireProfile } from "@/lib/session";
import TopBar from "@/components/TopBar";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function AccountPage() {
  const profile = await requireProfile();

  return (
    <>
      <TopBar profile={profile} />
      <main className="max-w-md mx-auto px-5 py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Account</h1>
          <p className="text-sm text-ink-2 mt-0.5">Your profile and login.</p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">
            Profile
          </p>
          <Row label="Name" value={profile.full_name} />
          <Row label="Email" value={profile.email ?? "—"} />
          <Row label="Phone" value={profile.phone ?? "—"} />
          <Row label="Truck" value={profile.truck_number ?? "—"} />
          {profile.role === "driver" && (
            <>
              <Row
                label="CDL Number"
                value={profile.cdl_number ?? "—"}
              />
              <Row
                label="License Expires"
                value={profile.license_expiration ?? "—"}
              />
              <Row
                label="Medical Card Expires"
                value={profile.medical_card_expiration ?? "—"}
              />
            </>
          )}
          <p className="text-xs text-muted pt-1">
            To update these details, contact your dispatcher.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3">
            Change Password
          </p>
          <ChangePasswordForm />
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
