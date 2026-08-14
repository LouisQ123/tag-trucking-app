"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { removeTicketFromInvoice, deleteInvoiceRecord, updateInvoiceStatus } from "@/lib/actions/invoices";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import type { Client, Invoice, InvoiceStatus, InvoiceTicket } from "@/lib/types/database";

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
function towAmount(t: InvoiceTicket): number | null {
  return t.tow_rate !== null && t.tow_count !== null ? t.tow_rate * t.tow_count : null;
}

export default function InvoiceDetail({
  invoice,
  client,
  tickets,
}: {
  invoice: Invoice;
  client: Client;
  tickets: InvoiceTicket[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(tickets);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [checkNumber, setCheckNumber] = useState(invoice.check_number ?? "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const total = rows.reduce(
    (sum, t) =>
      sum + (t.total_hours !== null && t.rate !== null ? t.total_hours * t.rate : 0) + (towAmount(t) ?? 0),
    0
  );
  const hasTow = rows.some((t) => towAmount(t) !== null);

  async function handleRemove(ticketId: string) {
    if (!confirm("Remove this ticket from the invoice? It stays on file and can be billed on a future invoice.")) return;
    setRemovingId(ticketId);
    try {
      await removeTicketFromInvoice(ticketId);
      setRows((r) => r.filter((t) => t.id !== ticketId));
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDeleteInvoice() {
    if (!confirm(`Delete invoice #${invoice.invoice_no}? Its tickets stay on file and become billable again.`)) return;
    setDeletingInvoice(true);
    try {
      await deleteInvoiceRecord(invoice.id);
      router.push("/admin/invoices/history");
    } finally {
      setDeletingInvoice(false);
    }
  }

  async function handleSaveStatus(nextStatus: "pending" | "paid") {
    setStatus(nextStatus);
    setStatusSaved(false);
    setSavingStatus(true);
    try {
      await updateInvoiceStatus(invoice.id, nextStatus, nextStatus === "paid" ? checkNumber : "");
      if (nextStatus === "pending") setCheckNumber("");
      setStatusSaved(true);
      router.refresh();
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveCheckNumber() {
    setStatusSaved(false);
    setSavingStatus(true);
    try {
      await updateInvoiceStatus(invoice.id, "paid", checkNumber);
      setStatusSaved(true);
      router.refresh();
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadInvoicePdf({
        invoiceNo: invoice.invoice_no,
        date: invoice.date,
        client: {
          name: client.name,
          company: client.company,
          address_line1: client.address_line1,
          city_state_zip: client.city_state_zip,
          phone: client.phone,
          fax: client.fax,
          email: client.email,
        },
        customer: invoice.customer ?? "",
        forDescription: invoice.for_description ?? "",
        terms: invoice.terms,
        lines: rows.map((t) => ({
          date: t.date,
          ticketNo: t.ticket_no,
          truckNumber: t.truck_number,
          hours: t.total_hours ?? 0,
          rate: t.rate,
          towAmount: towAmount(t),
        })),
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2">Bill To</p>
            <p className="font-bold">{client.name}</p>
            {client.company && <p className="font-semibold text-ink-2">{client.company}</p>}
            <p className="text-ink-2">
              {[client.address_line1, client.city_state_zip].filter(Boolean).join(", ") || "No address on file"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Date</p>
              <p className="font-semibold">{fmtDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Terms</p>
              <p className="font-semibold">{invoice.terms}</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Customer</p>
              <p className="font-semibold">{invoice.customer || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">For</p>
              <p className="font-semibold">{invoice.for_description || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3.5">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-2">Status</p>
            <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => handleSaveStatus("pending")}
                disabled={savingStatus}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-bold disabled:opacity-60 ${
                  status === "pending" ? "bg-warning text-ink" : "text-ink-2"
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => handleSaveStatus("paid")}
                disabled={savingStatus}
                className={`px-3.5 py-1.5 rounded-md text-[13px] font-bold disabled:opacity-60 ${
                  status === "paid" ? "bg-good text-accent-ink" : "text-ink-2"
                }`}
              >
                Paid
              </button>
            </div>
          </div>
          {status === "paid" && (
            <div className="flex-1 flex items-end gap-2.5 max-w-xs">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Check #</label>
                <input
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="Check number"
                  className="input"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveCheckNumber}
                disabled={savingStatus}
                className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          )}
          {statusSaved && <span className="text-sm font-semibold text-good">Saved.</span>}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3.5">
          Tickets ({rows.length})
        </p>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Ticket #</th>
                  <th className="py-2 pr-2">Truck #</th>
                  <th className="py-2 pr-2 text-right">Hours</th>
                  <th className="py-2 pr-2 text-right">Rate</th>
                  <th className="py-2 pr-2 text-right">Amount</th>
                  {hasTow && <th className="py-2 pr-2 text-right">Tow</th>}
                  <th className="py-2 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const amount = t.rate !== null ? (t.total_hours ?? 0) * t.rate : null;
                  const tow = towAmount(t);
                  return (
                    <tr key={t.id} className="border-t border-grid">
                      <td className="py-2 pr-2 tabular-nums">{fmtDate(t.date)}</td>
                      <td className="py-2 pr-2 text-ink-2 tabular-nums">{t.ticket_no ?? "—"}</td>
                      <td className="py-2 pr-2 text-ink-2 tabular-nums">{t.truck_number ?? "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{t.total_hours ?? "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {t.rate !== null ? currency(t.rate) : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right font-bold tabular-nums">
                        {amount !== null ? currency(amount) : "—"}
                      </td>
                      {hasTow && (
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {tow !== null ? currency(tow) : "—"}
                        </td>
                      )}
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/invoices/${t.id}`}
                          className="text-xs font-bold text-ink-2 hover:text-ink mr-3"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleRemove(t.id)}
                          disabled={removingId === t.id}
                          className="text-xs font-bold text-critical/70 hover:text-critical disabled:opacity-50"
                        >
                          {removingId === t.id ? "Removing…" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-2">
            No tickets left on this invoice — remove them all and this invoice is just a shell. Consider deleting it.
          </p>
        )}
        <div className="flex justify-end mt-3 pt-3 border-t border-grid">
          <span className="text-[13px] font-extrabold text-ink-2 mr-2">Total</span>
          <span className="text-[15px] font-extrabold text-accent tabular-nums">{currency(total)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleDeleteInvoice}
          disabled={deletingInvoice}
          className="text-xs font-bold text-critical/70 hover:text-critical disabled:opacity-50"
        >
          {deletingInvoice ? "Deleting…" : "Delete invoice"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || !rows.length}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {downloading ? "Generating…" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
