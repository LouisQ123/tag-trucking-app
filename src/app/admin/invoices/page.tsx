import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceTicket } from "@/lib/types/database";

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function dayOfWeek(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: "short" }) : "—";
}
function fmtDate(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function fmtTime(v: string | null): string {
  if (!v) return "—";
  const [h, m] = v.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data }, { data: invoiceRows }] = await Promise.all([
    supabase
      .from("invoice_tickets")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("invoices").select("id, invoice_no"),
  ]);
  const tickets = (data as InvoiceTicket[]) ?? [];
  const invoiceNoById = new Map(((invoiceRows ?? []) as { id: string; invoice_no: string }[]).map((i) => [i.id, i.invoice_no]));

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

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1420px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Day</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">No.</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Location / Project</th>
                <th className="px-4 py-2.5">Truck #</th>
                <th className="px-4 py-2.5">Time In</th>
                <th className="px-4 py-2.5">Time Out</th>
                <th className="px-4 py-2.5">Travel</th>
                <th className="px-4 py-2.5">Total Hrs</th>
                <th className="px-4 py-2.5">Rate</th>
                <th className="px-4 py-2.5">Loads</th>
                <th className="px-4 py-2.5">Tow</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const invoiceNo = t.invoice_id ? invoiceNoById.get(t.invoice_id) : null;
                return (
                  <tr key={t.id} className="border-t border-grid hover:bg-surface-2">
                    <td className="px-4 py-3 text-ink-2">{dayOfWeek(t.date)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <Link href={`/admin/invoices/${t.id}`} className="font-semibold hover:underline">
                        {fmtDate(t.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{t.ticket_no ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{t.client}</td>
                    <td className="px-4 py-3 text-ink-2">{t.location_project ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{t.truck_number ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{fmtTime(t.time_in)}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{fmtTime(t.time_out)}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">{t.travel_time_hours ?? "—"}</td>
                    <td className="px-4 py-3 font-bold text-accent tabular-nums">{t.total_hours ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">
                      {t.rate !== null ? `$${t.rate.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{t.loads ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-2 tabular-nums">
                      {t.tow_rate !== null && t.tow_count !== null
                        ? `$${(t.tow_rate * t.tow_count).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {invoiceNo ? (
                        <Link
                          href={`/admin/invoices/history/${t.invoice_id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-good hover:underline"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          #{invoiceNo}
                        </Link>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted">Not invoiced</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!tickets.length && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-ink-2">
                    No invoice tickets yet. Create your first one.
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
