import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types/database";

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtDate(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function InvoiceHistoryPage() {
  const supabase = await createClient();
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

  const rows = (invoices as Invoice[]) ?? [];

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

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Invoice #</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Tickets</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr key={inv.id} className="border-t border-grid hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/admin/invoices/history/${inv.id}`} className="font-semibold hover:underline">
                      #{inv.invoice_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{fmtDate(inv.date)}</td>
                  <td className="px-4 py-3">{clientNameById.get(inv.client_id) ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{ticketCountByInvoice.get(inv.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{currency(inv.total)}</td>
                  <td className="px-4 py-3">
                    {inv.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-good">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        Paid{inv.check_number ? ` · Chk #${inv.check_number}` : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-2">
                    No invoices generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
