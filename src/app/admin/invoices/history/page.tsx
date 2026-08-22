import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types/database";
import { getCurrentWorkWeek, isInWorkWeek, formatSubmitBy } from "@/lib/workWeek";
import InvoiceHistoryTable, { type InvoiceRow } from "./InvoiceHistoryTable";

export default async function InvoiceHistoryPage() {
  const supabase = await createClient();
  const week = getCurrentWorkWeek();
  const submitByLabel = formatSubmitBy(week);
  const [{ data: invoices }, { data: clients }, { data: ticketRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
    supabase.from("invoice_tickets").select("invoice_id").not("invoice_id", "is", null),
  ]);

  const clientNameById = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const ticketCountByInvoice = new Map<string, number>();
  ((ticketRows ?? []) as { invoice_id: string }[]).forEach((r) => {
    ticketCountByInvoice.set(r.invoice_id, (ticketCountByInvoice.get(r.invoice_id) ?? 0) + 1);
  });

  const rows: InvoiceRow[] = ((invoices as Invoice[]) ?? []).map((inv) => ({
    ...inv,
    clientName: clientNameById.get(inv.client_id) ?? "—",
    ticketCount: ticketCountByInvoice.get(inv.id) ?? 0,
    isNew: isInWorkWeek(inv.created_at, week),
  }));

  return (
    <main className="max-w-4xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Invoice History</h1>
          <p className="text-sm text-ink-2 mt-0.5">Every invoice you&apos;ve generated.</p>
        </div>
        <Link
          href="/admin/invoices"
          className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5"
        >
          Back to Tickets
        </Link>
      </div>

      <InvoiceHistoryTable rows={rows} submitByLabel={submitByLabel} />
    </main>
  );
}
