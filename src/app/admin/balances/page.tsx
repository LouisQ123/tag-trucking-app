import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice } from "@/lib/types/database";
import AddOldInvoiceForm from "./AddOldInvoiceForm";

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
function isNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < NEW_WINDOW_MS;
}

export default async function BalancesPage() {
  const supabase = await createClient();
  // Drafts aren't sent yet — they aren't a real receivable, so they're left
  // out of both the owed and paid totals entirely.
  const [{ data: clients }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("invoices").select("*").neq("status", "draft").order("date", { ascending: false }),
  ]);

  const clientRows = (clients as Client[]) ?? [];
  const invoiceRows = (invoices as Invoice[]) ?? [];

  const byClient = new Map<string, Invoice[]>();
  invoiceRows.forEach((inv) => {
    const list = byClient.get(inv.client_id) ?? [];
    list.push(inv);
    byClient.set(inv.client_id, list);
  });

  const balances = clientRows
    .map((client) => {
      const clientInvoices = byClient.get(client.id) ?? [];
      const owed = clientInvoices.filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0);
      const paid = clientInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
      return { client, invoices: clientInvoices, owed, paid };
    })
    .filter((b) => b.invoices.length > 0)
    // Clients still owing money surface first — that's the actionable view
    // for a balance sheet; fully paid-up clients sink to the bottom.
    .sort((a, b) => b.owed - a.owed || a.client.name.localeCompare(b.client.name));

  const totalOwed = balances.reduce((s, b) => s + b.owed, 0);
  const totalPaid = balances.reduce((s, b) => s + b.paid, 0);

  return (
    <main className="max-w-5xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Client Balances</h1>
        <p className="text-sm text-ink-2 mt-0.5">Every client&apos;s invoices owed and paid, with totals.</p>
      </div>

      {clientRows.length > 0 && <AddOldInvoiceForm clients={clientRows} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2">Total Owed</p>
          <p className="text-2xl font-extrabold text-warning tabular-nums">{currency(totalOwed)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2">Total Paid</p>
          <p className="text-2xl font-extrabold text-good tabular-nums">{currency(totalPaid)}</p>
        </div>
      </div>

      {balances.length === 0 ? (
        <p className="text-sm text-ink-2">No invoices yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {balances.map(({ client, invoices, owed, paid }) => (
            <div key={client.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-grid">
                <div>
                  <p className="font-bold">{client.name}</p>
                  {client.company && <p className="text-[12.5px] text-ink-2">{client.company}</p>}
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Owed</p>
                    <p
                      className={`text-sm font-extrabold tabular-nums ${
                        owed > 0 ? "text-warning" : "text-ink-2"
                      }`}
                    >
                      {currency(owed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Paid</p>
                    <p className="text-sm font-extrabold text-good tabular-nums">{currency(paid)}</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                      <th className="px-5 py-2">Invoice #</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Check #</th>
                      <th className="px-4 py-2">Date Paid</th>
                      <th className="px-4 py-2 text-right pr-5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-grid hover:bg-surface-2">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <Link
                              href={`/admin/invoices/history/${inv.id}`}
                              className="font-semibold hover:underline"
                            >
                              #{inv.invoice_no}
                            </Link>
                            {isNew(inv.created_at) && (
                              <span className="shrink-0 text-[9.5px] font-extrabold uppercase tracking-wide text-accent-ink bg-accent rounded px-1.5 py-0.5">
                                New
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{fmtDate(inv.date)}</td>
                        <td className="px-4 py-2.5">
                          {inv.status === "paid" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-good">
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning">
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-ink-2 tabular-nums">{inv.check_number ?? "—"}</td>
                        <td className="px-4 py-2.5 text-ink-2 tabular-nums">{fmtDate(inv.check_received_date)}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums pr-5">
                          {currency(inv.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
