import { createClient } from "@/lib/supabase/server";
import type { Driver } from "@/lib/types/database";
import SheetEditor from "../SheetEditor";

export default async function NewSheetPage() {
  const supabase = await createClient();
  const [{ data: roster }, { data: pastSheets }] = await Promise.all([
    supabase.from("drivers").select("full_name, hourly_pay"),
    supabase.from("production_sheets").select("driver_name"),
  ]);

  const rosterRows = (roster ?? []) as Pick<Driver, "full_name" | "hourly_pay">[];
  const driverNameSuggestions = Array.from(
    new Set([
      ...rosterRows.map((d) => d.full_name),
      ...((pastSheets ?? []) as { driver_name: string }[]).map((s) => s.driver_name),
    ])
  ).sort((a, b) => a.localeCompare(b));
  const driverPayRates = Object.fromEntries(
    rosterRows.filter((d) => d.hourly_pay !== null).map((d) => [d.full_name, d.hourly_pay as number])
  );

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">New Production Sheet</h1>
        <p className="text-sm text-ink-2 mt-0.5">Log a driver&apos;s loads, hours, fuel, and mileage.</p>
      </div>
      <SheetEditor driverNameSuggestions={driverNameSuggestions} driverPayRates={driverPayRates} />
    </main>
  );
}
