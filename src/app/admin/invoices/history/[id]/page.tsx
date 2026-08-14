import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, InvoiceTicket } from "@/lib/types/database";
import InvoiceDetail from "./InvoiceDetail";

export default async function InvoiceHistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) notFound();

  const [{ data: clients }, { data: tickets }, { data: availableTickets }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("invoice_tickets").select("*").eq("invoice_id", id).order("date"),
    supabase.from("invoice_tickets").select("*").is("invoice_id", null).order("date"),
  ]);

  const clientRows = (clients as Client[]) ?? [];
  if (!clientRows.some((c) => c.id === invoice.client_id)) notFound();

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Invoice #{invoice.invoice_no}</h1>
        <p className="text-sm text-ink-2 mt-0.5">Generated {new Date(invoice.created_at).toLocaleDateString()}.</p>
      </div>
      <InvoiceDetail
        invoice={invoice as Invoice}
        clients={clientRows}
        tickets={(tickets as InvoiceTicket[]) ?? []}
        availableTickets={(availableTickets as InvoiceTicket[]) ?? []}
      />
    </main>
  );
}
