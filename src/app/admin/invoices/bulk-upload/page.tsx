import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types/database";
import BulkUploadForm from "./BulkUploadForm";

export default async function BulkUploadPage() {
  const supabase = await createClient();
  const [{ data }, { data: clients }] = await Promise.all([
    supabase.from("invoice_tickets").select("client, location_project"),
    supabase.from("clients").select("name, default_rate"),
  ]);
  const rows = (data ?? []) as { client: string; location_project: string | null }[];
  const clientRows = (clients ?? []) as Pick<Client, "name" | "default_rate">[];

  const clientSuggestions = Array.from(
    new Set([...rows.map((r) => r.client), ...clientRows.map((c) => c.name)].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const locationSuggestions = Array.from(
    new Set(rows.map((r) => r.location_project).filter((v): v is string => !!v))
  ).sort((a, b) => a.localeCompare(b));
  const clientDefaultRates = Object.fromEntries(
    clientRows.filter((c) => c.default_rate !== null).map((c) => [c.name, c.default_rate as number])
  );

  return (
    <main className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Bulk Upload Tickets</h1>
          <p className="text-sm text-ink-2 mt-0.5">Upload one scan with a whole week&apos;s tickets on it.</p>
        </div>
        <Link href="/admin/invoices" className="text-xs font-bold text-ink-2 hover:text-ink">
          Back to Tickets
        </Link>
      </div>
      <BulkUploadForm
        clientSuggestions={clientSuggestions}
        locationSuggestions={locationSuggestions}
        clientDefaultRates={clientDefaultRates}
      />
    </main>
  );
}
