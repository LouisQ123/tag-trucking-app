import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, InvoiceTicket } from "@/lib/types/database";
import InvoiceDetail from "./InvoiceDetail";

export default async function InvoiceHistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) notFound();

  const [{ data: client }, { data: tickets }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", invoice.client_id).single(),
    supabase.from("invoice_tickets").select("*").eq("invoice_id", id).order("date"),
  ]);

  if (!client) notFound();

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Invoice #{invoice.invoice_no}</h1>
        <p className="text-sm text-ink-2 mt-0.5">Generated {new Date(invoice.created_at).toLocaleDateString()}.</p>
      </div>
      <InvoiceDetail
        invoice={invoice as Invoice}
        client={client as Client}
        tickets={(tickets as InvoiceTicket[]) ?? []}
      />
    </main>
  );
}
