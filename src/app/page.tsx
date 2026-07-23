import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";
import SheetForm from "@/components/SheetForm";
import type { ProductionSheet } from "@/lib/types/database";

export default async function DriverHome() {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/admin");

  const supabase = await createClient();
  const { data: sheets } = await supabase
    .from("production_sheets")
    .select("*, loads(*)")
    .eq("driver_id", profile.id)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("submitted_at", { ascending: false })
    .limit(20);

  return (
    <>
      <TopBar profile={profile} />
      <main className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-10">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Daily Production Sheet</h1>
          <p className="text-sm text-ink-2 mt-0.5">
            Welcome, {profile.full_name.split(" ")[0]}. Log today&apos;s loads, hours, fuel, and mileage.
          </p>
        </div>

        <SheetForm defaultTruck={profile.truck_number ?? ""} driverId={profile.id} />

        <History sheets={(sheets as ProductionSheet[]) ?? []} />
      </main>
    </>
  );
}

function History({ sheets }: { sheets: ProductionSheet[] }) {
  if (!sheets.length) return null;
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3">
        Your Recent Sheets
      </p>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Truck</th>
                <th className="px-4 py-2.5">Loads</th>
                <th className="px-4 py-2.5">Miles</th>
                <th className="px-4 py-2.5">MPG</th>
                <th className="px-4 py-2.5">Hours</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <tr key={s.id} className="border-t border-grid tabular-nums">
                  <td className="px-4 py-2.5">{s.date}</td>
                  <td className="px-4 py-2.5">{s.truck_number}</td>
                  <td className="px-4 py-2.5">{s.loads?.length ?? 0}</td>
                  <td className="px-4 py-2.5">{s.total_miles ?? "—"}</td>
                  <td className="px-4 py-2.5">{s.mpg ?? "—"}</td>
                  <td className="px-4 py-2.5">{s.hours ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
