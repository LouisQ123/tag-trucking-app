import { createClient } from "@/lib/supabase/server";
import type { ProductionSheet } from "@/lib/types/database";
import TrashTable from "./TrashTable";

export default async function TrashPage() {
  const supabase = await createClient();
  const { data: sheets } = await supabase
    .from("production_sheets")
    .select("*, loads(*), profiles(full_name, truck_number)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Trash</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Deleted sheets are kept here, not erased. Restore anything removed by mistake.
        </p>
      </div>
      <TrashTable sheets={(sheets as ProductionSheet[]) ?? []} />
    </main>
  );
}
