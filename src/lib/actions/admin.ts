"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function softDeleteSheet(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_sheets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/trash");
}

export async function restoreSheet(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_sheets")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/admin/trash");
}

export async function exportAllData(): Promise<string> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: sheets }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase
      .from("production_sheets")
      .select("*, loads(*)")
      .order("date", { ascending: false }),
  ]);

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      note: "Includes soft-deleted sheets (deleted_at set) for a complete archival record.",
      profiles: profiles ?? [],
      productionSheets: sheets ?? [],
    },
    null,
    2
  );
}
