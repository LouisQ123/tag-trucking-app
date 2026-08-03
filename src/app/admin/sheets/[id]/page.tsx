import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductionSheet, Driver } from "@/lib/types/database";
import SheetEditor from "../SheetEditor";

export default async function EditSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sheet }, { data: roster }, { data: pastSheets }] = await Promise.all([
    supabase.from("production_sheets").select("*, loads(*)").eq("id", id).single(),
    supabase.from("drivers").select("full_name, hourly_pay"),
    supabase.from("production_sheets").select("driver_name"),
  ]);

  if (!sheet) notFound();

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
        <h1 className="text-xl font-extrabold tracking-tight">Edit Production Sheet</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Changes are saved immediately and reflected in payroll and the dashboard.
        </p>
      </div>
      <SheetEditor
        sheet={sheet as ProductionSheet}
        driverNameSuggestions={driverNameSuggestions}
        driverPayRates={driverPayRates}
      />
    </main>
  );
}
