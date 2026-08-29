"use client";

import { useMemo, useState } from "react";
import { createTicketFromExtraction } from "@/lib/actions/invoices";
import type { ExtractedTicket } from "@/lib/actions/ticketScanExtraction";
import { computeTotalHours } from "@/lib/ticketMath";
import { TRUCK_NUMBERS } from "@/lib/loadOptions";
import TimeInput from "@/components/TimeInput";
import DateInput from "@/components/DateInput";
import ComboInput from "@/components/ComboInput";

// One editable card per extra ticket detected on a scan alongside the main
// one already filling InvoiceEditor's form. Each card creates its own
// ticket row independently (via createTicketFromExtraction, which — unlike
// createInvoiceTicket — doesn't redirect on success, so saving one doesn't
// abandon the rest of the review list) and shares the same scan_path,
// since every ticket found here came from that one uploaded file.
export default function ExtraTicketCard({
  index,
  initial,
  scanPath,
  clientSuggestions,
  locationSuggestions,
  clientDefaultRates,
}: {
  index: number;
  initial: ExtractedTicket;
  scanPath: string;
  clientSuggestions: string[];
  locationSuggestions: string[];
  clientDefaultRates: Record<string, number>;
}) {
  const [ticketNo, setTicketNo] = useState(initial.ticketNo);
  const [date, setDate] = useState(initial.date);
  const [client, setClient] = useState(initial.client);
  const [locationProject, setLocationProject] = useState(initial.locationProject);
  const [truck, setTruck] = useState(initial.truckNumber);
  const [timeIn, setTimeIn] = useState(initial.timeIn);
  const [timeOut, setTimeOut] = useState(initial.timeOut);
  const [travelTime, setTravelTime] = useState(initial.travelTimeHours);
  const [loads, setLoads] = useState(initial.loads);
  const [rate, setRate] = useState(initial.rate);
  const [rateTouched, setRateTouched] = useState(false);
  const [towRate, setTowRate] = useState(initial.towRate);
  const [towCount, setTowCount] = useState(initial.towCount);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [attachedToInvoiceNo, setAttachedToInvoiceNo] = useState<string | null>(null);
  const [discarded, setDiscarded] = useState(false);

  const totalHours = useMemo(
    () => computeTotalHours(timeIn, timeOut, travelTime),
    [timeIn, timeOut, travelTime]
  );

  function onClientChange(name: string) {
    setClient(name);
    if (!rateTouched && name in clientDefaultRates) {
      setRate(String(clientDefaultRates[name]));
    }
  }

  async function handleSave() {
    if (!date || !client) {
      setError("Date and client are required.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createTicketFromExtraction({
      ticketNo,
      date,
      client,
      locationProject,
      truckNumber: truck,
      timeIn,
      timeOut,
      travelTimeHours: travelTime,
      totalHours: totalHours !== null ? String(totalHours) : "",
      loads,
      rate,
      towRate,
      towCount,
      scanPath,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setAttachedToInvoiceNo(result.attachedToInvoiceNo);
    setSaved(true);
  }

  if (discarded) return null;

  if (saved) {
    return (
      <div className="rounded-lg border border-good/30 bg-good/10 px-4 py-3 text-sm font-semibold text-good">
        Ticket {index} created — #{ticketNo || "no ticket #"} for {client}.
        {attachedToInvoiceNo && ` Added to this week's open draft invoice #${attachedToInvoiceNo}.`}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Ticket {index}</span>
        <button
          type="button"
          onClick={() => setDiscarded(true)}
          className="text-xs font-bold text-ink-2 hover:text-critical"
        >
          Discard
        </button>
      </div>

      {error && <p className="text-sm font-semibold text-critical">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <MiniField label="Date">
          <DateInput
            name={`extra-${index}-date`}
            defaultValue={date}
            onChange={setDate}
            className="input-sm flex items-center justify-between gap-1.5"
          />
        </MiniField>
        <MiniField label="No.">
          <input value={ticketNo} onChange={(e) => setTicketNo(e.target.value)} className="input-sm" />
        </MiniField>
        <MiniField label="Client">
          <ComboInput value={client} onChange={onClientChange} suggestions={clientSuggestions} className="input-sm" />
        </MiniField>
        <MiniField label="Location / Project">
          <ComboInput
            value={locationProject}
            onChange={setLocationProject}
            suggestions={locationSuggestions}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Truck #">
          <ComboInput value={truck} onChange={setTruck} suggestions={TRUCK_NUMBERS} className="input-sm" />
        </MiniField>
        <MiniField label="Time In">
          <TimeInput name={`extra-${index}-in`} defaultValue={timeIn} onChange={setTimeIn} />
        </MiniField>
        <MiniField label="Time Out">
          <TimeInput name={`extra-${index}-out`} defaultValue={timeOut} onChange={setTimeOut} />
        </MiniField>
        <MiniField label="Travel (hrs)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={travelTime}
            onChange={(e) => setTravelTime(e.target.value)}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Total Hours">
          <div className="text-[13px] font-bold text-accent py-1.5 tabular-nums">{totalHours ?? "—"}</div>
        </MiniField>
        <MiniField label="Loads">
          <input
            type="number"
            min={0}
            step={1}
            value={loads}
            onChange={(e) => setLoads(e.target.value)}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Rate ($/hr)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={rate}
            onChange={(e) => {
              setRateTouched(true);
              setRate(e.target.value);
            }}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Tow Rate">
          <input
            type="number"
            min={0}
            step={0.25}
            value={towRate}
            onChange={(e) => setTowRate(e.target.value)}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Tow Count">
          <input
            type="number"
            min={0}
            step={1}
            value={towCount}
            onChange={(e) => setTowCount(e.target.value)}
            className="input-sm"
          />
        </MiniField>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-5 py-2 disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create This Ticket"}
        </button>
      </div>
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10px] font-bold uppercase tracking-wide text-ink-2">{label}</label>
      {children}
    </div>
  );
}
