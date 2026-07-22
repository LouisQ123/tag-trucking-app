import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProductionSheet, Profile } from "@/lib/types/database";
import EditSheetForm from "./EditSheetForm";

export default async function EditSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: sheet }, { data: drivers }] = await Promise.all([
    supabase.from("production_sheets").select("*, loads(*)").eq("id", id).single(),
    supabase.from("profiles").select("*").eq("role", "driver").order("full_name"),
  ]);

  if (!sheet) notFound();

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Edit Production Sheet</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Changes are saved immediately and reflected in payroll and the dashboard.
        </p>
      </div>
      <EditSheetForm sheet={sheet as ProductionSheet} drivers={(drivers as Profile[]) ?? []} />
    </main>
  );
}
