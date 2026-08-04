import { createClient } from "@/lib/supabase/server";
import ReportsView from "@/components/admin/ReportsView";
import type { ProductionSheet } from "@/lib/types/database";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: sheets } = await supabase
    .from("production_sheets")
    .select("*, loads(id)")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-5 py-7">
      <ReportsView sheets={(sheets as ProductionSheet[]) ?? []} />
    </main>
  );
}
