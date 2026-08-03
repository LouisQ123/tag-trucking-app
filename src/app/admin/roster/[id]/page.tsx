import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Driver } from "@/lib/types/database";
import EditDriverForm from "./EditDriverForm";

export default async function EditRosterDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: driver } = await supabase.from("drivers").select("*").eq("id", id).single();

  if (!driver) notFound();

  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Edit Driver</h1>
        <p className="text-sm text-ink-2 mt-0.5">Changes take effect immediately.</p>
      </div>
      <EditDriverForm driver={driver as Driver} />
    </main>
  );
}
