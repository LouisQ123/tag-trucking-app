import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import EditDriverForm from "./EditDriverForm";

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!data) notFound();

  return (
    <main className="max-w-lg mx-auto px-5 py-7">
      <h1 className="text-xl font-extrabold tracking-tight mb-0.5">{(data as Profile).full_name}</h1>
      <p className="text-sm text-ink-2 mb-6">Edit assignment, pay, and compliance details.</p>
      <EditDriverForm profile={data as Profile} />
    </main>
  );
}
