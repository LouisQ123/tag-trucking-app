import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types/database";
import InvoiceEditor from "../InvoiceEditor";

export default async function NewInvoiceTicketPage() {
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
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">New Invoice Ticket</h1>
        <p className="text-sm text-ink-2 mt-0.5">Log a client job to invoice later.</p>
      </div>
      <InvoiceEditor
        clientSuggestions={clientSuggestions}
        locationSuggestions={locationSuggestions}
        clientDefaultRates={clientDefaultRates}
      />
    </main>
  );
}
