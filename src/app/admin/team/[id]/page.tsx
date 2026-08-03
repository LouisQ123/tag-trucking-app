import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import EditAdminForm from "./EditAdminForm";

export default async function EditAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (!profile) notFound();

  return (
    <main className="max-w-lg mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Edit Admin</h1>
        <p className="text-sm text-ink-2 mt-0.5">Changes take effect immediately.</p>
      </div>
      <EditAdminForm profile={profile as Profile} />
    </main>
  );
}
