import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client, InvoiceTicket } from "@/lib/types/database";
import GenerateInvoiceForm from "./GenerateInvoiceForm";

function nextInvoiceNumber(existing: string[]): string {
  const numbers = existing.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  const max = numbers.length ? Math.max(...numbers) : 0;
  return String(max + 1);
}

export default async function GenerateInvoicePage() {
  const supabase = await createClient();
  const [{ data: clients }, { data: tickets }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("invoice_tickets").select("*").is("invoice_id", null).order("date"),
    supabase.from("invoices").select("invoice_no"),
  ]);

  const clientRows = (clients as Client[]) ?? [];
  const nextNo = nextInvoiceNumber(((invoices ?? []) as { invoice_no: string }[]).map((i) => i.invoice_no));

  if (!clientRows.length) {
    return (
      <main className="max-w-xl mx-auto px-5 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-extrabold tracking-tight">Generate Invoice</h1>
          <p className="text-sm text-ink-2 mt-0.5">
            You need at least one client on file before you can generate an invoice.
          </p>
        </div>
        <Link
          href="/admin/clients/new"
          className="inline-block rounded-lg bg-accent text-accent-ink font-bold text-sm px-5 py-2.5"
        >
          + Add a Client
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Generate Invoice</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Pick a client, choose which tickets to bill, and download the invoice PDF.
        </p>
      </div>
      <GenerateInvoiceForm
        clients={clientRows}
        tickets={(tickets as InvoiceTicket[]) ?? []}
        nextInvoiceNo={nextNo}
      />
    </main>
  );
}
