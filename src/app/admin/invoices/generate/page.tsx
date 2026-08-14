import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, InvoiceTicket } from "@/lib/types/database";
import GenerateInvoiceForm from "./GenerateInvoiceForm";

function nextInvoiceNumber(existing: string[]): string {
  const numbers = existing.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  const max = numbers.length ? Math.max(...numbers) : 0;
  return String(max + 1);
}

export default async function GenerateInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft: draftId } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: invoices }, { data: draft }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("invoices").select("invoice_no"),
    draftId
      ? supabase.from("invoices").select("*").eq("id", draftId).eq("status", "draft").single()
      : Promise.resolve({ data: null }),
  ]);

  // A draft's own tickets are already linked to it (invoice_id set), so the
  // usual "un-invoiced" filter would hide them — include tickets linked to
  // this draft alongside the un-invoiced pool.
  const ticketsQuery = supabase.from("invoice_tickets").select("*").order("date");
  const { data: tickets } = draft
    ? await ticketsQuery.or(`invoice_id.is.null,invoice_id.eq.${draft.id}`)
    : await ticketsQuery.is("invoice_id", null);

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

  const draftTicketIds = (draft as Invoice | null)
    ? ((tickets as InvoiceTicket[]) ?? []).filter((t) => t.invoice_id === draftId).map((t) => t.id)
    : undefined;

  return (
    <main className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">
          {draft ? "Continue Draft Invoice" : "Generate Invoice"}
        </h1>
        <p className="text-sm text-ink-2 mt-0.5">
          {draft
            ? "Pick up where you left off — save your progress again or send it when it's ready."
            : "Pick a client, choose which tickets to bill, save it as a draft, or send it when it's ready."}
        </p>
      </div>
      <GenerateInvoiceForm
        clients={clientRows}
        tickets={(tickets as InvoiceTicket[]) ?? []}
        nextInvoiceNo={nextNo}
        draft={(draft as Invoice | null) ?? null}
        draftTicketIds={draftTicketIds}
      />
    </main>
  );
}
