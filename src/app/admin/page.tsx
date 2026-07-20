import { createClient } from "@/lib/supabase/server";
import AdminDashboard from "@/components/admin/AdminDashboard";
import type { ProductionSheet } from "@/lib/types/database";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: sheets } = await supabase
    .from("production_sheets")
    .select("*, loads(*), profiles(full_name, truck_number)")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  return (
    <main className="max-w-6xl mx-auto px-5 py-7">
      <AdminDashboard sheets={(sheets as ProductionSheet[]) ?? []} />
    </main>
  );
}
