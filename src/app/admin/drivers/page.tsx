import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function ComplianceBadge({ label, dateStr }: { label: string; dateStr: string | null }) {
  const days = daysUntil(dateStr);
  if (days === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
        {label}: —
      </span>
    );
  }
  const tone = days < 0 ? "critical" : days <= 30 ? "warning" : "good";
  const toneClass =
    tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : "text-good";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${toneClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}: {dateStr} {days < 0 ? "(expired)" : days <= 30 ? `(${days}d)` : ""}
    </span>
  );
}

export default async function DriversPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  const profiles = (data as Profile[]) ?? [];

  return (
    <main className="max-w-6xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Drivers</h1>
          <p className="text-sm text-ink-2 mt-0.5">Accounts, pay rate, and compliance.</p>
        </div>
        <Link
          href="/admin/drivers/new"
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2.5"
        >
          + Add Driver
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Truck</th>
                <th className="px-4 py-2.5">Pay Rate</th>
                <th className="px-4 py-2.5">Compliance</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-grid">
                  <td className="px-4 py-3">
                    <Link href={`/admin/drivers/${p.id}`} className="font-semibold hover:underline">
                      {p.full_name}
                    </Link>
                    <div className="text-xs text-muted">{p.email}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{p.role}</td>
                  <td className="px-4 py-3 tabular-nums">{p.truck_number ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {p.hourly_pay !== null ? `$${p.hourly_pay.toFixed(2)}/hr` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <ComplianceBadge label="CDL" dateStr={p.license_expiration} />
                      <ComplianceBadge label="Medical" dateStr={p.medical_card_expiration} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        p.active ? "bg-good/10 text-good" : "bg-muted/15 text-muted"
                      }`}
                    >
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {!profiles.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-2">
                    No drivers yet. Add your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
