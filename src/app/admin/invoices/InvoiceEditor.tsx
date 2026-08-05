"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createInvoiceTicket, updateInvoiceTicket, deleteInvoiceTicket } from "@/lib/actions/invoices";
import type { ActionState } from "@/lib/actions/auth";
import { TRUCK_NUMBERS } from "@/lib/loadOptions";
import TimeInput from "@/components/TimeInput";
import DateInput from "@/components/DateInput";
import ComboInput from "@/components/ComboInput";
import type { InvoiceTicket } from "@/lib/types/database";

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

function dayOfWeek(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: "long" }) : "—";
}

function computeTotalHours(timeIn: string, timeOut: string, travel: string): number | null {
  if (!timeIn || !timeOut) return null;
  const [ih, im] = timeIn.split(":").map(Number);
  const [oh, om] = timeOut.split(":").map(Number);
  let diff = oh * 60 + om - (ih * 60 + im);
  if (diff < 0) diff += 24 * 60;
  const hours = Math.max(diff / 60 - (Number(travel) || 0), 0);
  return Math.round(hours * 100) / 100;
}

const initialState: ActionState = {};

export default function InvoiceEditor({
  ticket,
  clientSuggestions,
  locationSuggestions,
  clientDefaultRates = {},
  invoicedLabel,
}: {
  ticket?: InvoiceTicket;
  clientSuggestions: string[];
  locationSuggestions: string[];
  clientDefaultRates?: Record<string, number>;
  invoicedLabel?: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    ticket ? updateInvoiceTicket : createInvoiceTicket,
    initialState
  );
  const [removing, setRemoving] = useState(false);

  const [ticketNo, setTicketNo] = useState(ticket?.ticket_no ?? "");
  const [date, setDate] = useState(ticket?.date ?? todayISO());
  const [client, setClient] = useState(ticket?.client ?? "");
  const [locationProject, setLocationProject] = useState(ticket?.location_project ?? "");
  const [truck, setTruck] = useState(ticket?.truck_number ?? "");
  const [companyName, setCompanyName] = useState(ticket?.company_name ?? "ATG Trucking LLC");
  const [timeIn, setTimeIn] = useState(ticket?.time_in ?? "");
  const [timeOut, setTimeOut] = useState(ticket?.time_out ?? "");
  const [travelTime, setTravelTime] = useState(
    ticket?.travel_time_hours !== null && ticket?.travel_time_hours !== undefined
      ? String(ticket.travel_time_hours)
      : ""
  );
  const [loads, setLoads] = useState(
    ticket?.loads !== null && ticket?.loads !== undefined ? String(ticket.loads) : ""
  );
  const [rate, setRate] = useState(
    ticket?.rate !== null && ticket?.rate !== undefined ? String(ticket.rate) : ""
  );
  const [rateTouched, setRateTouched] = useState(false);

  function onClientChange(name: string) {
    setClient(name);
    if (!rateTouched && name in clientDefaultRates) {
      setRate(String(clientDefaultRates[name]));
    }
  }

  const totalHours = useMemo(
    () => computeTotalHours(timeIn, timeOut, travelTime),
    [timeIn, timeOut, travelTime]
  );

  const [lastHandledState, setLastHandledState] = useState(state);
  const [saved, setSaved] = useState(false);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) setSaved(true);
  }

  async function handleRemove() {
    if (!ticket) return;
    if (!confirm("Delete this invoice ticket? This can't be undone.")) return;
    setRemoving(true);
    try {
      await deleteInvoiceTicket(ticket.id);
      router.push("/admin/invoices");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {ticket && <input type="hidden" name="id" value={ticket.id} />}
      <input type="hidden" name="total_hours" value={totalHours ?? ""} />

      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <Card title="Ticket">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
          <Field label="Date">
            <DateInput name="date" defaultValue={date} onChange={setDate} required />
          </Field>
          <Field label="Day">
            <div className="input flex items-center text-ink-2">{dayOfWeek(date)}</div>
          </Field>
          <Field label="No.">
            <input
              name="ticket_no"
              value={ticketNo}
              onChange={(e) => setTicketNo(e.target.value)}
              placeholder="Ticket #"
              className="input"
            />
          </Field>
        </div>
      </Card>

      <Card title="Client & Job">
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3.5">
          <Field label="Client">
            <ComboInput
              name="client"
              required
              value={client}
              onChange={onClientChange}
              suggestions={clientSuggestions}
              placeholder="Type or pick a client"
            />
          </Field>
          <Field label="Location / Project">
            <ComboInput
              name="location_project"
              value={locationProject}
              onChange={setLocationProject}
              suggestions={locationSuggestions}
            />
          </Field>
          <Field label="Truck #">
            <ComboInput
              name="truck_number"
              value={truck}
              onChange={setTruck}
              suggestions={TRUCK_NUMBERS}
            />
          </Field>
          <Field label="Your Company Name">
            <input
              name="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Card>

      <Card title="Time">
        <div className="flex flex-col sm:grid sm:grid-cols-4 gap-3.5">
          <Field label="Time In">
            <TimeInput name="time_in" defaultValue={timeIn} onChange={setTimeIn} />
          </Field>
          <Field label="Time Out">
            <TimeInput name="time_out" defaultValue={timeOut} onChange={setTimeOut} />
          </Field>
          <Field label="Travel Time (hrs)">
            <input
              type="number"
              name="travel_time_hours"
              min={0}
              step={0.25}
              value={travelTime}
              onChange={(e) => setTravelTime(e.target.value)}
              placeholder="0.0"
              className="input"
            />
          </Field>
          <Field label="Total Hours" hint="Time out − time in − travel">
            <div className="font-bold text-accent text-[15px] py-2 tabular-nums">
              {totalHours !== null ? totalHours : "—"}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Loads & Billing">
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3.5">
          <Field label="Loads">
            <input
              type="number"
              name="loads"
              min={0}
              step={1}
              value={loads}
              onChange={(e) => setLoads(e.target.value)}
              placeholder="0"
              className="input"
            />
          </Field>
          <Field label="Rate ($/hr)" hint="Used to compute the Amount on a generated invoice">
            <input
              type="number"
              name="rate"
              min={0}
              step={0.25}
              value={rate}
              onChange={(e) => {
                setRateTouched(true);
                setRate(e.target.value);
              }}
              placeholder="0.00"
              className="input"
            />
          </Field>
        </div>
      </Card>

      {invoicedLabel && (
        <div className="rounded-lg bg-accent-dim border border-accent/30 text-sm font-semibold text-accent px-4 py-3">
          Included on {invoicedLabel}. Editing this ticket won&apos;t update that invoice.
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {ticket ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs font-bold text-critical/70 hover:text-critical disabled:opacity-50"
          >
            {removing ? "Removing…" : "Delete ticket"}
          </button>
        ) : (
          <Link href="/admin/invoices" className="text-xs font-bold text-ink-2 hover:text-ink">
            Cancel
          </Link>
        )}
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-semibold text-good">Saved.</span>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
          >
            {pending ? "Saving…" : ticket ? "Save Changes" : "Create Ticket"}
          </button>
        </div>
      </div>
    </form>
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
