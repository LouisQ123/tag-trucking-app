import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Driver } from "@/lib/types/database";

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

export default async function RosterPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("drivers").select("*").order("full_name");
  const drivers = (data as Driver[]) ?? [];

  return (
    <main className="max-w-5xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Roster</h1>
          <p className="text-sm text-ink-2 mt-0.5">Driver contact info, pay rate, and compliance.</p>
        </div>
        <Link
          href="/admin/roster/new"
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
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Pay Rate</th>
                <th className="px-4 py-2.5">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-t border-grid">
                  <td className="px-4 py-3">
                    <Link href={`/admin/roster/${d.id}`} className="font-semibold hover:underline">
                      {d.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{d.phone ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {d.hourly_pay !== null ? `$${d.hourly_pay.toFixed(2)}/hr` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <ComplianceBadge label="CDL" dateStr={d.license_expiration} />
                      <ComplianceBadge label="Medical" dateStr={d.medical_card_expiration} />
                    </div>
                  </td>
                </tr>
              ))}
              {!drivers.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-ink-2">
                    No drivers on the roster yet. Add your first one.
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
