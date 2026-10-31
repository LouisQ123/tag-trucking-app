import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Driver } from "@/lib/types/database";
import EditDriverForm from "./EditDriverForm";

export default async function EditRosterDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // The PIN hash is never sent to the browser — only whether one is set.
  const [{ data: driver }, { data: pinRow }] = await Promise.all([
    supabase
      .from("drivers")
      .select("id, full_name, phone, hourly_pay, cdl_number, license_expiration, medical_card_expiration, created_at")
      .eq("id", id)
      .single(),
    supabase.from("drivers").select("pin_hash").eq("id", id).maybeSingle(),
  ]);

  if (!driver) notFound();
  const hasPin = !!(pinRow as { pin_hash: string | null } | null)?.pin_hash;

  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Edit Driver</h1>
        <p className="text-sm text-ink-2 mt-0.5">Changes take effect immediately.</p>
      </div>
      <EditDriverForm driver={driver as Driver} hasPin={hasPin} />
    </main>
  );
}
