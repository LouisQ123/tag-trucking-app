"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLegacyInvoice } from "@/lib/actions/invoices";
import DateInput from "@/components/DateInput";
import type { Client } from "@/lib/types/database";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AddOldInvoiceForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(todayISO());
  const [total, setTotal] = useState("");
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [checkNumber, setCheckNumber] = useState("");
  const [checkReceivedDate, setCheckReceivedDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setInvoiceNo("");
    setDate(todayISO());
    setTotal("");
    setStatus("pending");
    setCheckNumber("");
    setCheckReceivedDate(todayISO());
    setError(null);
  }

  async function handleSave() {
    setError(null);
    const amount = Number(total);
    if (!clientId || !invoiceNo.trim() || !date) {
      setError("Client, invoice number, and date are required.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createLegacyInvoice({
        clientId,
        invoiceNo: invoiceNo.trim(),
        date,
        total: amount,
        status,
        checkNumber,
        checkReceivedDate,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5 w-fit"
      >
        + Add Old Invoice
      </button>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3.5">
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">
        Add Old Invoice
      </p>
      <p className="text-[12.5px] text-ink-2 -mt-2">
        For a billing record from before this app tracked invoices — no tickets needed, just the totals.
      </p>

      {error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {error}
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
          <DateInput name="legacy_invoice_date" defaultValue={date} onChange={setDate} />
        </Field>
        <Field label="Amount">
          <input
            type="number"
            min={0}
            step={0.01}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0.00"
            className="input"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Status</label>
        <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setStatus("pending")}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-bold ${
              status === "pending" ? "bg-warning text-ink" : "text-ink-2"
            }`}
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setStatus("paid")}
            className={`px-3.5 py-1.5 rounded-md text-[13px] font-bold ${
              status === "paid" ? "bg-good text-accent-ink" : "text-ink-2"
            }`}
          >
            Paid
          </button>
        </div>
      </div>

      {status === "paid" && (
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3.5">
          <Field label="Check #">
            <input
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Check number"
              className="input"
            />
          </Field>
          <Field label="Date Received">
            <DateInput
              name="legacy_check_date"
              defaultValue={checkReceivedDate}
              onChange={setCheckReceivedDate}
            />
          </Field>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={submitting}
          className="text-xs font-bold text-ink-2 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0 w-full">
      <label className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
    </div>
  );
}
