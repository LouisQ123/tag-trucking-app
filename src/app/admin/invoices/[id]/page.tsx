import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, InvoiceTicket } from "@/lib/types/database";
import InvoiceEditor from "../InvoiceEditor";

export default async function EditInvoiceTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: ticket }, { data: rows }, { data: clients }] = await Promise.all([
    supabase.from("invoice_tickets").select("*").eq("id", id).single(),
    supabase.from("invoice_tickets").select("client, location_project"),
    supabase.from("clients").select("name, default_rate"),
  ]);

  if (!ticket) notFound();

  let invoicedLabel: string | null = null;
  if (ticket.invoice_id) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_no")
      .eq("id", ticket.invoice_id)
      .single();
    if (invoice) invoicedLabel = `Invoice #${invoice.invoice_no}`;
  }

  const allRows = (rows ?? []) as { client: string; location_project: string | null }[];
  const clientRows = (clients ?? []) as Pick<Client, "name" | "default_rate">[];
  const clientSuggestions = Array.from(
    new Set([...allRows.map((r) => r.client), ...clientRows.map((c) => c.name)].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const locationSuggestions = Array.from(
    new Set(allRows.map((r) => r.location_project).filter((v): v is string => !!v))
  ).sort((a, b) => a.localeCompare(b));
  const clientDefaultRates = Object.fromEntries(
    clientRows.filter((c) => c.default_rate !== null).map((c) => [c.name, c.default_rate as number])
  );

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Edit Invoice Ticket</h1>
        <p className="text-sm text-ink-2 mt-0.5">Changes take effect immediately.</p>
      </div>
      <InvoiceEditor
        ticket={ticket as InvoiceTicket}
        clientSuggestions={clientSuggestions}
        locationSuggestions={locationSuggestions}
        clientDefaultRates={clientDefaultRates}
        invoicedLabel={invoicedLabel}
      />
    </main>
  );
}
