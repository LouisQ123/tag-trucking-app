"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { updateSheet } from "@/lib/actions/sheets";
import type { ActionState } from "@/lib/actions/auth";
import { DUMPING_LOCATIONS, MATERIAL_TYPES, COMPANIES } from "@/lib/loadOptions";
import TimeInput from "@/components/TimeInput";
import type { ProductionSheet, Profile } from "@/lib/types/database";

interface LoadRow {
  key: string;
  jobSite: string;
  dumping: string;
  type: string;
  company: string;
  jobSiteArrivalTime: string;
  jobSiteDepartureTime: string;
}

function newLoad(): LoadRow {
  return {
    key: Math.random().toString(36).slice(2),
    jobSite: "",
    dumping: "",
    type: "",
    company: "",
    jobSiteArrivalTime: "",
    jobSiteDepartureTime: "",
  };
}

const initialState: ActionState = {};

export default function EditSheetForm({
  sheet,
  drivers,
}: {
  sheet: ProductionSheet;
  drivers: Profile[];
}) {
  const [state, formAction, pending] = useActionState(updateSheet, initialState);

  const [driverId, setDriverId] = useState(sheet.driver_id);
  const [date, setDate] = useState(sheet.date);
  const [truck, setTruck] = useState(sheet.truck_number ?? "");
  const [startTime, setStartTime] = useState(sheet.start_time ?? "");
  const [endTime, setEndTime] = useState(sheet.end_time ?? "");
  const [hours, setHours] = useState(sheet.hours !== null ? String(sheet.hours) : "");
  const [hoursTouched, setHoursTouched] = useState(false);
  const [fuel, setFuel] = useState(sheet.fuel_gallons !== null ? String(sheet.fuel_gallons) : "");
  const [startMiles, setStartMiles] = useState(sheet.start_miles !== null ? String(sheet.start_miles) : "");
  const [endMiles, setEndMiles] = useState(sheet.end_miles !== null ? String(sheet.end_miles) : "");
  const [remarks, setRemarks] = useState(sheet.remarks ?? "");
  const [loads, setLoads] = useState<LoadRow[]>(
    sheet.loads?.length
      ? sheet.loads.map((l) => ({
          key: l.id,
          jobSite: l.job_site ?? "",
          dumping: l.dumping ?? "",
          type: l.type ?? "",
          company: l.company ?? "",
          jobSiteArrivalTime: l.job_site_arrival_time ?? "",
          jobSiteDepartureTime: l.job_site_departure_time ?? "",
        }))
      : [newLoad()]
  );

  function onStartEnd(nextStart: string, nextEnd: string) {
    if (!hoursTouched && nextStart && nextEnd) {
      const [sh, sm] = nextStart.split(":").map(Number);
      const [eh, em] = nextEnd.split(":").map(Number);
      let diff = eh * 60 + em - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      setHours(String(Math.round((diff / 60) * 100) / 100));
    }
  }

  const totalMiles = useMemo(() => {
    const s = Number(startMiles),
      e = Number(endMiles);
    if (startMiles === "" || endMiles === "" || e < s) return null;
    return e - s;
  }, [startMiles, endMiles]);

  const mpg = useMemo(() => {
    const f = Number(fuel);
    if (totalMiles === null || !fuel || f <= 0) return null;
    return Math.round((totalMiles / f) * 10) / 10;
  }, [totalMiles, fuel]);

  function updateLoad(key: string, field: keyof LoadRow, value: string) {
    setLoads((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={sheet.id} />
      <input type="hidden" name="loads" value={JSON.stringify(loads)} />
      <datalist id="dumping-locations">
        {DUMPING_LOCATIONS.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>
      <datalist id="material-types">
        {MATERIAL_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="companies">
        {COMPANIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <Card title="Sheet">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
          <Field label="Driver">
            <select
              name="driver_id"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              required
              className="input"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              name="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Truck Number">
            <input
              type="text"
              name="truck_number"
              required
              value={truck}
              onChange={(e) => setTruck(e.target.value)}
              className="input"
            />
          </Field>
        </div>
      </Card>

      <Card title="Shift">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
          <Field label="Start Time">
            <TimeInput
              name="start_time"
              defaultValue={startTime}
              onChange={(v) => {
                setStartTime(v);
                onStartEnd(v, endTime);
              }}
            />
          </Field>
          <Field label="End Time">
            <TimeInput
              name="end_time"
              defaultValue={endTime}
              onChange={(v) => {
                setEndTime(v);
                onStartEnd(startTime, v);
              }}
            />
          </Field>
          <Field label="Total Hours" hint="Fills in from start/end time">
            <input
              type="number"
              name="hours"
              min={0}
              step={0.25}
              value={hours}
              onChange={(e) => {
                setHoursTouched(true);
                setHours(e.target.value);
              }}
              placeholder="auto"
              className="input"
            />
          </Field>
        </div>
      </Card>

      <Card title="Fuel & Mileage">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
          <Field label="Fuel (gallons)">
            <input
              type="number"
              name="fuel_gallons"
              min={0}
              step={0.1}
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              placeholder="0.0"
              className="input"
            />
          </Field>
          <Field label="Start Miles">
            <input
              type="number"
              name="start_miles"
              min={0}
              value={startMiles}
              onChange={(e) => setStartMiles(e.target.value)}
              placeholder="0"
              className="input"
            />
          </Field>
          <Field label="End Miles">
            <input
              type="number"
              name="end_miles"
              min={0}
              value={endMiles}
              onChange={(e) => setEndMiles(e.target.value)}
              placeholder="0"
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3.5 mt-3.5">
          <Field label="Total Miles">
            <div className="font-bold text-accent text-[15px] py-2 tabular-nums">
              {totalMiles !== null ? `${totalMiles.toLocaleString()} mi` : "—"}
            </div>
          </Field>
          <Field label="Fuel Efficiency">
            <div className="font-bold text-accent text-[15px] py-2 tabular-nums">
              {mpg !== null ? `${mpg} mpg` : "—"}
            </div>
          </Field>
        </div>
      </Card>

      <Card
        title={
          <>
            Loads <span className="ml-1.5 bg-accent-dim text-accent text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full">{loads.length}</span>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {loads.map((row, i) => (
            <div key={row.key} className="rounded-lg border border-border p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-muted tabular-nums">Load {i + 1}</span>
                <button
                  type="button"
                  onClick={() => loads.length > 1 && setLoads((r) => r.filter((x) => x.key !== row.key))}
                  className="w-6.5 h-6.5 rounded-md border border-border text-muted hover:text-critical hover:border-critical text-sm"
                  aria-label="Remove load"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-4 gap-2.5">
                <input
                  className="input-sm"
                  placeholder="Job site / plant"
                  value={row.jobSite}
                  onChange={(e) => updateLoad(row.key, "jobSite", e.target.value)}
                />
                <input
                  className="input-sm"
                  placeholder="Dumping location"
                  list="dumping-locations"
                  value={row.dumping}
                  onChange={(e) => updateLoad(row.key, "dumping", e.target.value)}
                />
                <input
                  className="input-sm"
                  placeholder="Material type"
                  list="material-types"
                  value={row.type}
                  onChange={(e) => updateLoad(row.key, "type", e.target.value)}
                />
                <input
                  className="input-sm"
                  placeholder="Company"
                  list="companies"
                  value={row.company}
                  onChange={(e) => updateLoad(row.key, "company", e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Job Site Arrival
                  </span>
                  <TimeInput
                    name={`load-${row.key}-job-arrival`}
                    defaultValue={row.jobSiteArrivalTime}
                    onChange={(v) => updateLoad(row.key, "jobSiteArrivalTime", v)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Job Site Departure
                  </span>
                  <TimeInput
                    name={`load-${row.key}-job-departure`}
                    defaultValue={row.jobSiteDepartureTime}
                    onChange={(v) => updateLoad(row.key, "jobSiteDepartureTime", v)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLoads((r) => [...r, newLoad()])}
          className="mt-3 w-full rounded-lg border border-dashed border-border text-ink-2 hover:border-accent hover:text-accent font-bold text-[13px] py-2.5"
        >
          + Add another load
        </button>
      </Card>

      <Card title="Remarks">
        <textarea
          name="remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Breakdowns, delays, site notes…"
          rows={3}
          className="input resize-y"
        />
      </Card>

      <div className="flex justify-end gap-3">
        <Link
          href="/admin"
          className="rounded-lg border border-border text-ink-2 font-bold text-sm px-5 py-2.5 flex items-center"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
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
