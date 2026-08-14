"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  removeTicketFromInvoice,
  deleteInvoiceRecord,
  updateInvoiceStatus,
  updateInvoiceFields,
  addTicketsToInvoice,
} from "@/lib/actions/invoices";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import DateInput from "@/components/DateInput";
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
  clients,
  tickets,
  availableTickets,
}: {
  invoice: Invoice;
  clients: Client[];
  tickets: InvoiceTicket[];
  availableTickets: InvoiceTicket[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(tickets);
  const [pool, setPool] = useState(availableTickets);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [checkNumber, setCheckNumber] = useState(invoice.check_number ?? "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusSaved, setStatusSaved] = useState(false);

  const [clientId, setClientId] = useState(invoice.client_id);
  const [invoiceNo, setInvoiceNo] = useState(invoice.invoice_no);
  const [date, setDate] = useState(invoice.date);
  const [customer, setCustomer] = useState(invoice.customer ?? "");
  const [forDescription, setForDescription] = useState(invoice.for_description ?? "");
  const [terms, setTerms] = useState(invoice.terms);
  const [savingFields, setSavingFields] = useState(false);
  const [fieldsSaved, setFieldsSaved] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const [showAddTickets, setShowAddTickets] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [addingTickets, setAddingTickets] = useState(false);

  const client = clients.find((c) => c.id === clientId) ?? clients[0];

  const total = rows.reduce(
    (sum, t) =>
      sum + (t.total_hours !== null && t.rate !== null ? t.total_hours * t.rate : 0) + (towAmount(t) ?? 0),
    0
  );
  const hasTow = rows.some((t) => towAmount(t) !== null);

  async function handleSaveFields() {
    setFieldsError(null);
    if (!clientId || !invoiceNo.trim() || !date) {
      setFieldsError("Client, invoice number, and date are required.");
      return;
    }
    setFieldsSaved(false);
    setSavingFields(true);
    try {
      const result = await updateInvoiceFields(invoice.id, {
        clientId,
        invoiceNo: invoiceNo.trim(),
        date,
        customer: customer.trim(),
        forDescription: forDescription.trim(),
        terms: terms.trim() || "Net 30 days",
      });
      if ("error" in result) {
        setFieldsError(result.error);
        return;
      }
      setFieldsSaved(true);
      router.refresh();
    } finally {
      setSavingFields(false);
    }
  }

  function toggleAddSelect(id: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddTickets() {
    if (!selectedToAdd.size) return;
    setAddingTickets(true);
    try {
      const ids = Array.from(selectedToAdd);
      await addTicketsToInvoice(invoice.id, ids);
      const added = pool.filter((t) => selectedToAdd.has(t.id));
      setRows((r) => [...r, ...added].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
      setPool((p) => p.filter((t) => !selectedToAdd.has(t.id)));
      setSelectedToAdd(new Set());
      setShowAddTickets(false);
      router.refresh();
    } finally {
      setAddingTickets(false);
    }
  }

  async function handleRemove(ticketId: string) {
    if (!confirm("Remove this ticket from the invoice? It stays on file and can be billed on a future invoice.")) return;
    setRemovingId(ticketId);
    try {
      await removeTicketFromInvoice(ticketId);
      const removed = rows.find((t) => t.id === ticketId);
      setRows((r) => r.filter((t) => t.id !== ticketId));
      if (removed) setPool((p) => [...p, removed]);
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDeleteInvoice() {
    if (!confirm(`Delete invoice #${invoiceNo}? Its tickets stay on file and become billable again.`)) return;
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
        invoiceNo,
        date,
        client: {
          name: client.name,
          company: client.company,
          address_line1: client.address_line1,
          city_state_zip: client.city_state_zip,
          phone: client.phone,
          fax: client.fax,
          email: client.email,
        },
        customer,
        forDescription,
        terms,
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
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3.5">Invoice Details</p>
        {fieldsError && (
          <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3 mb-3.5">
            {fieldsError}
          </div>
        )}
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3.5">
          <Field label="Client">
            <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice #">
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="input" />
          </Field>
          <Field label="Date">
            <DateInput name="invoice_date" defaultValue={date} onChange={setDate} />
          </Field>
          <Field label="Terms">
            <input value={terms} onChange={(e) => setTerms(e.target.value)} className="input" />
          </Field>
          <Field label="Customer">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Optional — the actual job customer, if different"
              className="input"
            />
          </Field>
          <Field label="For">
            <input value={forDescription} onChange={(e) => setForDescription(e.target.value)} className="input" />
          </Field>
        </div>
        <p className="text-[12.5px] text-ink-2 mt-3">
          {[client.company, client.address_line1, client.city_state_zip].filter(Boolean).join(", ") ||
            "No address on file"}
        </p>
        <div className="flex items-center gap-3 mt-3.5 pt-3.5 border-t border-grid">
          <button
            type="button"
            onClick={handleSaveFields}
            disabled={savingFields}
            className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5 disabled:opacity-60"
          >
            {savingFields ? "Saving…" : "Save Changes"}
          </button>
          {fieldsSaved && <span className="text-sm font-semibold text-good">Saved.</span>}
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
        <div className="flex items-center justify-between mb-3.5">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Tickets ({rows.length})</p>
          <button
            type="button"
            onClick={() => setShowAddTickets((v) => !v)}
            className="text-xs font-bold text-accent hover:underline"
          >
            {showAddTickets ? "Cancel" : "+ Add Tickets"}
          </button>
        </div>

        {showAddTickets && (
          <div className="mb-4 pb-4 border-b border-grid">
            {pool.length ? (
              <>
                <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <tbody>
                      {pool.map((t) => (
                        <tr
                          key={t.id}
                          className="border-t border-grid first:border-t-0 hover:bg-surface-2 cursor-pointer"
                          onClick={() => toggleAddSelect(t.id)}
                        >
                          <td className="py-2 pl-3 pr-2 w-8">
                            <input
                              type="checkbox"
                              checked={selectedToAdd.has(t.id)}
                              onChange={() => toggleAddSelect(t.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="py-2 pr-2 tabular-nums">{fmtDate(t.date)}</td>
                          <td className="py-2 pr-2 text-ink-2 tabular-nums">{t.ticket_no ?? "—"}</td>
                          <td className="py-2 pr-3 font-semibold">{t.client}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={handleAddTickets}
                    disabled={addingTickets || !selectedToAdd.size}
                    className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2 disabled:opacity-60"
                  >
                    {addingTickets ? "Adding…" : `Add ${selectedToAdd.size || ""} Ticket${selectedToAdd.size === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-2">No un-invoiced tickets available to add.</p>
            )}
          </div>
        )}

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0 w-full">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
    </div>
  );
}
