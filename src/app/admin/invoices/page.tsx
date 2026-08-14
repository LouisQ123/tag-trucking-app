import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceTicket } from "@/lib/types/database";
import TicketsTable from "./TicketsTable";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data }, { data: invoiceRows }] = await Promise.all([
    supabase
      .from("invoice_tickets")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, invoice_no, status"),
  ]);
  const tickets = (data as InvoiceTicket[]) ?? [];
  const invoiceById = new Map(
    ((invoiceRows ?? []) as { id: string; invoice_no: string; status: string }[]).map((i) => [
      i.id,
      { invoiceNo: i.invoice_no, status: i.status },
    ])
  );
  const hasTow = tickets.some((t) => t.tow_rate !== null && t.tow_count !== null);

  return (
    <main className="max-w-6xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Invoices</h1>
          <p className="text-sm text-ink-2 mt-0.5">Client billing tickets, ready to turn into an invoice.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/invoices/history"
            className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5"
          >
            Invoice History
          </Link>
          <Link
            href="/admin/invoices/generate"
            className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5"
          >
            Generate Invoice
          </Link>
          <Link
            href="/admin/invoices/new"
            className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2.5"
          >
            + New Ticket
          </Link>
        </div>
      </div>

      <TicketsTable tickets={tickets} invoiceById={invoiceById} hasTow={hasTow} />
    </main>
  );
}
