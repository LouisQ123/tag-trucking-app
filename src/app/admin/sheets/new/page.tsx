import { createClient } from "@/lib/supabase/server";
import { DRIVER_NAMES } from "@/lib/loadOptions";
import SheetEditor from "../SheetEditor";

export default async function NewSheetPage() {
  const supabase = await createClient();
  const { data: pastSheets } = await supabase.from("production_sheets").select("driver_name");

  const driverNameSuggestions = Array.from(
    new Set([...DRIVER_NAMES, ...((pastSheets ?? []) as { driver_name: string }[]).map((s) => s.driver_name)])
  ).sort((a, b) => a.localeCompare(b));

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">New Production Sheet</h1>
        <p className="text-sm text-ink-2 mt-0.5">Log a driver&apos;s loads, hours, fuel, and mileage.</p>
      </div>
      <SheetEditor driverNameSuggestions={driverNameSuggestions} />
    </main>
  );
}
