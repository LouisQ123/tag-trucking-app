"use client";

import type { ExtractedTicket } from "@/lib/actions/ticketScanExtraction";
import { computeTotalHours } from "@/lib/ticketMath";
import { TRUCK_NUMBERS } from "@/lib/loadOptions";
import TimeInput from "@/components/TimeInput";
import DateInput from "@/components/DateInput";
import ComboInput from "@/components/ComboInput";

export type RowStatus = "idle" | "saving" | "saved" | "error";

// Controlled counterpart to ExtraTicketCard — same field set and styling,
// but the parent (BulkUploadForm) owns every row's data so a single "Save
// All" click can gather the whole batch at once, instead of each card
// managing its own state and saving independently.
export default function BulkTicketRow({
  index,
  data,
  onChange,
  onDiscard,
  status,
  error,
  attachedToInvoiceNo,
  clientSuggestions,
  locationSuggestions,
  clientDefaultRates,
}: {
  index: number;
  data: ExtractedTicket;
  onChange: (patch: Partial<ExtractedTicket>) => void;
  onDiscard: () => void;
  status: RowStatus;
  error: string | null;
  attachedToInvoiceNo: string | null;
  clientSuggestions: string[];
  locationSuggestions: string[];
  clientDefaultRates: Record<string, number>;
}) {
  const totalHours = computeTotalHours(data.timeIn, data.timeOut, data.travelTimeHours);

  function onClientChange(name: string) {
    const patch: Partial<ExtractedTicket> = { client: name };
    if (name in clientDefaultRates) patch.rate = String(clientDefaultRates[name]);
    onChange(patch);
  }

  if (status === "saved") {
    return (
      <div className="rounded-lg border border-good/30 bg-good/10 px-4 py-3 text-sm font-semibold text-good">
        Ticket {index} created — #{data.ticketNo || "no ticket #"} for {data.client}.
        {attachedToInvoiceNo && ` Added to this week's open draft invoice #${attachedToInvoiceNo}.`}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-3 ${
        status === "error" ? "border-critical/30" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-muted">Ticket {index}</span>
        <button
          type="button"
          onClick={onDiscard}
          disabled={status === "saving"}
          className="text-xs font-bold text-ink-2 hover:text-critical disabled:opacity-50"
        >
          Discard
        </button>
      </div>

      {error && <p className="text-sm font-semibold text-critical">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <MiniField label="Date">
          <DateInput
            name={`bulk-${index}-date`}
            defaultValue={data.date}
            onChange={(v) => onChange({ date: v })}
            className="input-sm flex items-center justify-between gap-1.5"
          />
        </MiniField>
        <MiniField label="No.">
          <input value={data.ticketNo} onChange={(e) => onChange({ ticketNo: e.target.value })} className="input-sm" />
        </MiniField>
        <MiniField label="Client">
          <ComboInput value={data.client} onChange={onClientChange} suggestions={clientSuggestions} className="input-sm" />
        </MiniField>
        <MiniField label="Location / Project">
          <ComboInput
            value={data.locationProject}
            onChange={(v) => onChange({ locationProject: v })}
            suggestions={locationSuggestions}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Truck #">
          <ComboInput value={data.truckNumber} onChange={(v) => onChange({ truckNumber: v })} suggestions={TRUCK_NUMBERS} className="input-sm" />
        </MiniField>
        <MiniField label="Time In">
          <TimeInput name={`bulk-${index}-in`} defaultValue={data.timeIn} onChange={(v) => onChange({ timeIn: v })} />
        </MiniField>
        <MiniField label="Time Out">
          <TimeInput name={`bulk-${index}-out`} defaultValue={data.timeOut} onChange={(v) => onChange({ timeOut: v })} />
        </MiniField>
        <MiniField label="Travel (hrs)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={data.travelTimeHours}
            onChange={(e) => onChange({ travelTimeHours: e.target.value })}
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
            value={data.loads}
            onChange={(e) => onChange({ loads: e.target.value })}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Rate ($/hr)">
          <input
            type="number"
            min={0}
            step={0.25}
            value={data.rate}
            onChange={(e) => onChange({ rate: e.target.value })}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Tow Rate">
          <input
            type="number"
            min={0}
            step={0.25}
            value={data.towRate}
            onChange={(e) => onChange({ towRate: e.target.value })}
            className="input-sm"
          />
        </MiniField>
        <MiniField label="Tow Count">
          <input
            type="number"
            min={0}
            step={1}
            value={data.towCount}
            onChange={(e) => onChange({ towCount: e.target.value })}
            className="input-sm"
          />
        </MiniField>
      </div>

      {status === "saving" && <p className="text-xs font-semibold text-ink-2">Saving…</p>}
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
