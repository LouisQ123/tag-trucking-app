"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveInvoice } from "@/lib/actions/invoices";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import DateInput from "@/components/DateInput";
import type { Client, Invoice, InvoiceTicket } from "@/lib/types/database";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
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

export default function GenerateInvoiceForm({
  clients,
  tickets,
  nextInvoiceNo,
  draft,
  draftTicketIds,
}: {
  clients: Client[];
  tickets: InvoiceTicket[];
  nextInvoiceNo: string;
  draft?: Invoice | null;
  draftTicketIds?: string[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(draft?.client_id ?? clients[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState(draft?.invoice_no ?? nextInvoiceNo);
  const [date, setDate] = useState(draft?.date ?? todayISO());
  const [customer, setCustomer] = useState(draft?.customer ?? "");
  const [forDescription, setForDescription] = useState(draft?.for_description ?? "Dump Truck Rental");
  const [terms, setTerms] = useState(draft?.terms ?? "Net 30 days");
  // Tracks which invoice row we're saving to — set once a draft is first
  // saved (or immediately if resuming one), so every subsequent Save Draft
  // or Send updates that same row instead of creating duplicates.
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | undefined>(draft?.id);

  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ type: "draft" | "sent"; invoiceNo: string; total: number } | null>(
    null
  );
  const [lastGenerated, setLastGenerated] = useState<(() => Promise<void>) | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? null;

  // Every un-invoiced ticket is selectable here, not just ones whose free-text
  // Client field happens to match this Bill-To exactly — a typo'd or
  // differently-worded client name on a ticket shouldn't hide it from being
  // picked. Tickets matching the selected client are pre-checked as a
  // convenience default; everything else stays available to check by hand.
  const sortedTickets = useMemo(
    () =>
      [...tickets].sort((a, b) => {
        const aMatch = client && a.client === client.name ? 0 : 1;
        const bMatch = client && b.client === client.name ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      }),
    [tickets, client]
  );

  const [selected, setSelected] = useState<Set<string>>(() =>
    draft
      ? new Set(draftTicketIds ?? [])
      : new Set(tickets.filter((t) => client && t.client === client.name).map((t) => t.id))
  );

  function onClientChange(id: string) {
    setClientId(id);
    const nextClient = clients.find((c) => c.id === id) ?? null;
    setSelected(new Set(tickets.filter((t) => nextClient && t.client === nextClient.name).map((t) => t.id)));
    setSuccess(null);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasTow = sortedTickets.some((t) => towAmount(t) !== null);
  const selectedTickets = sortedTickets.filter((t) => selected.has(t.id));
  const total = selectedTickets.reduce(
    (sum, t) => sum + (t.rate !== null ? (t.total_hours ?? 0) * t.rate : 0) + (towAmount(t) ?? 0),
    0
  );

  async function handleSaveDraft() {
    setError(null);
    if (!client) {
      setError("Pick a client.");
      return;
    }
    if (!invoiceNo.trim()) {
      setError("Invoice number is required.");
      return;
    }

    setSavingDraft(true);
    try {
      const result = await saveInvoice({
        invoiceId: currentInvoiceId,
        clientId: client.id,
        invoiceNo: invoiceNo.trim(),
        date,
        customer: customer.trim(),
        forDescription: forDescription.trim(),
        terms: terms.trim() || "Net 30 days",
        ticketIds: selectedTickets.map((t) => t.id),
        total,
        status: "draft",
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setCurrentInvoiceId(result.id);
      setSuccess({ type: "draft", invoiceNo: invoiceNo.trim(), total });
      router.refresh();
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    if (!client) {
      setError("Pick a client.");
      return;
    }
    if (!invoiceNo.trim()) {
      setError("Invoice number is required.");
      return;
    }
    if (!selectedTickets.length) {
      setError("Select at least one ticket to bill.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveInvoice({
        invoiceId: currentInvoiceId,
        clientId: client.id,
        invoiceNo: invoiceNo.trim(),
        date,
        customer: customer.trim(),
        forDescription: forDescription.trim(),
        terms: terms.trim() || "Net 30 days",
        ticketIds: selectedTickets.map((t) => t.id),
        total,
        status: "pending",
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      const download = () =>
        downloadInvoicePdf({
          invoiceNo: invoiceNo.trim(),
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
          customer: customer.trim(),
          forDescription: forDescription.trim(),
          terms: terms.trim() || "Net 30 days",
          lines: selectedTickets.map((t) => ({
            date: t.date,
            ticketNo: t.ticket_no,
            truckNumber: t.truck_number,
            hours: t.total_hours ?? 0,
            rate: t.rate,
            towAmount: towAmount(t),
            scanPath: t.scan_path,
          })),
        });

      await download();
      setLastGenerated(() => download);
      setSuccess({ type: "sent", invoiceNo: invoiceNo.trim(), total });
      // This invoice is finalized now — a further Save Draft or Send in this
      // session should start a new invoice, not keep editing this one.
      setCurrentInvoiceId(undefined);
      // Advance the field for the next invoice in this session — router.refresh()
      // re-fetches nextInvoiceNo from the server, but a prop change alone
      // doesn't reset state already initialized from it.
      const submittedAsNumber = Number(invoiceNo.trim());
      if (Number.isInteger(submittedAsNumber) && submittedAsNumber > 0) {
        setInvoiceNo(String(submittedAsNumber + 1));
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {error}
        </div>
      )}
      {success && success.type === "sent" && (
        <div className="rounded-lg bg-good/10 border border-good/30 text-sm font-semibold text-good px-4 py-3 flex items-center justify-between gap-3">
          <span>
            Invoice #{success.invoiceNo} sent — {currency(success.total)}.
          </span>
          <button
            type="button"
            onClick={() => lastGenerated?.()}
            className="rounded-md border border-good/40 text-good font-bold text-xs px-3 py-1.5"
          >
            Download again
          </button>
        </div>
      )}
      {success && success.type === "draft" && (
        <div className="rounded-lg bg-accent-dim border border-accent/30 text-sm font-semibold text-accent px-4 py-3">
          Draft #{success.invoiceNo} saved — {currency(success.total)}. Come back anytime from Invoice History to
          finish it.
        </div>
      )}

      <Card title="Bill To">
        <Field label="Client">
          <select
            className="input"
            value={clientId}
            onChange={(e) => onClientChange(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {client && (
          <p className="text-[12.5px] text-ink-2 mt-2">
            {[client.company, client.address_line1, client.city_state_zip].filter(Boolean).join(", ") ||
              "No address on file"}
          </p>
        )}
      </Card>

      <Card title="Invoice Details">
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3.5">
          <Field label="Invoice #" hint="Auto-suggested — edit if you need a different number">
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Date">
            <DateInput name="invoice_date" defaultValue={date} onChange={setDate} />
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
          <Field label="Terms">
            <input value={terms} onChange={(e) => setTerms(e.target.value)} className="input" />
          </Field>
        </div>
      </Card>

      <Card title={`Tickets to Bill (${selectedTickets.length} of ${sortedTickets.length})`}>
        {sortedTickets.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Ticket #</th>
                  <th className="py-2 pr-2">Client</th>
                  <th className="py-2 pr-2">Truck #</th>
                  <th className="py-2 pr-2 text-right">Hours</th>
                  <th className="py-2 pr-2 text-right">Rate</th>
                  <th className="py-2 pr-2 text-right">Amount</th>
                  {hasTow && <th className="py-2 pr-2 text-right">Tow</th>}
                </tr>
              </thead>
              <tbody>
                {sortedTickets.map((t) => {
                  const amount = t.rate !== null ? (t.total_hours ?? 0) * t.rate : null;
                  const tow = towAmount(t);
                  const isMatch = client && t.client === client.name;
                  return (
                    <tr key={t.id} className="border-t border-grid">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                        />
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{fmtDate(t.date)}</td>
                      <td className="py-2 pr-2 text-ink-2 tabular-nums">{t.ticket_no ?? "—"}</td>
                      <td className={`py-2 pr-2 ${isMatch ? "font-semibold" : "text-muted"}`}>{t.client}</td>
                      <td className="py-2 pr-2 text-ink-2 tabular-nums">{t.truck_number ?? "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{t.total_hours ?? "—"}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {t.rate !== null ? currency(t.rate) : <span className="text-warning">not set</span>}
                      </td>
                      <td className="py-2 pr-2 text-right font-bold tabular-nums">
                        {amount !== null ? currency(amount) : "—"}
                      </td>
                      {hasTow && (
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {tow !== null ? currency(tow) : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-2">No un-invoiced tickets yet.</p>
        )}
        <div className="flex justify-end mt-3 pt-3 border-t border-grid">
          <span className="text-[13px] font-extrabold text-ink-2 mr-2">Total</span>
          <span className="text-[15px] font-extrabold text-accent tabular-nums">{currency(total)}</span>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={savingDraft || submitting}
          className="rounded-lg border border-border text-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {savingDraft ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={submitting || savingDraft || !selectedTickets.length}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Generate Invoice PDF"}
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3.5 flex items-center">
        {title}
      </p>
      {children}
    </div>
  );
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0 w-full">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  );
}
