"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { submitSheet } from "@/lib/actions/sheets";
import type { ActionState } from "@/lib/actions/auth";
import { DUMPING_LOCATIONS, MATERIAL_TYPES, COMPANIES } from "@/lib/loadOptions";
import TimeInput from "@/components/TimeInput";

interface LoadRow {
  key: string;
  jobSite: string;
  dumping: string;
  type: string;
  company: string;
  jobSiteArrivalTime: string;
  jobSiteDepartureTime: string;
  note: string;
}

interface Draft {
  date: string;
  truck: string;
  startTime: string;
  endTime: string;
  hours: string;
  hoursTouched: boolean;
  fuel: string;
  startMiles: string;
  endMiles: string;
  remarks: string;
  loads: LoadRow[];
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
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
    note: "",
  };
}

function draftKey(driverId: string) {
  return `atg-sheet-draft-${driverId}`;
}

// In-progress sheets are saved to this device (not the server) so a driver
// filling this out across a shift — closing the app, losing signal, a
// phone restart — doesn't lose their progress. Cleared once actually
// submitted. Guarded for SSR, where localStorage doesn't exist.
function loadDraft(driverId: string): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(driverId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(driverId: string, draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(draftKey(driverId), JSON.stringify(draft));
  } catch {
    // Storage full or disabled — the driver can still submit normally,
    // they just won't get autosave.
  }
}
function clearDraft(driverId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(driverId));
  } catch {
    // ignore
  }
}

// A draft with nothing but default values (today's date, the driver's
// default truck, no times, no loads filled in) isn't real progress —
// don't persist it, and don't show the "restored" banner for it if an old
// one is still sitting in storage.
function isBlankDraft(draft: Draft, defaultTruck: string): boolean {
  const rowBlank = (l: LoadRow) =>
    !l.jobSite && !l.dumping && !l.type && !l.company && !l.jobSiteArrivalTime && !l.jobSiteDepartureTime && !l.note;
  return (
    (draft.truck || "") === defaultTruck &&
    !draft.startTime &&
    !draft.endTime &&
    !draft.hours &&
    !draft.fuel &&
    !draft.startMiles &&
    !draft.endMiles &&
    !draft.remarks &&
    draft.loads.every(rowBlank)
  );
}

const initialState: ActionState = {};

export default function SheetForm({ defaultTruck, driverId }: { defaultTruck: string; driverId: string }) {
  const [state, formAction, pending] = useActionState(submitSheet, initialState);
  const [dismissed, setDismissed] = useState(false);
  const [savedDate, setSavedDate] = useState("");

  const [date, setDate] = useState(todayISO());
  const [truck, setTruck] = useState(defaultTruck);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hours, setHours] = useState("");
  const [hoursTouched, setHoursTouched] = useState(false);
  const [fuel, setFuel] = useState("");
  const [startMiles, setStartMiles] = useState("");
  const [endMiles, setEndMiles] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loads, setLoads] = useState<LoadRow[]>([newLoad(), newLoad()]);
  // Start/End Time are uncontrolled (see TimeInput) so normal typing never
  // remounts them. Bumping this key is the only way we force them back to
  // blank — on "Clear", after a successful submit, or restoring a draft.
  const [timeResetKey, setTimeResetKey] = useState(0);
  const [draftRestored, setDraftRestored] = useState(false);
  // Guards the autosave effect from firing (and overwriting a real draft
  // with these blank initial values) before we've had a chance to restore.
  // State, not a ref: the restore effect's setState calls for date/truck/etc
  // don't apply until the next render, so if this were a ref, the autosave
  // effect (running in that same initial commit) would still read the old
  // blank closure values yet see the ref already flipped to true, and
  // immediately overwrite the draft it just restored with those blanks.
  const [hydrated, setHydrated] = useState(false);

  function clearFields() {
    setDate(todayISO());
    setTruck(defaultTruck);
    setStartTime("");
    setEndTime("");
    setHours("");
    setHoursTouched(false);
    setFuel("");
    setStartMiles("");
    setEndMiles("");
    setRemarks("");
    setLoads([newLoad(), newLoad()]);
    setTimeResetKey((k) => k + 1);
    setDraftRestored(false);
    clearDraft(driverId);
  }

  // Restore any in-progress draft for this driver once, on mount. This is
  // a legitimate use of an effect (unlike a plain "adjust state during
  // render" case) — localStorage is an external system unavailable during
  // render/SSR, so it can only be read here.
  useEffect(() => {
    const draft = loadDraft(driverId);
    if (draft && !isBlankDraft(draft, defaultTruck)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(draft.date || todayISO());
      setTruck(draft.truck || defaultTruck);
      setStartTime(draft.startTime || "");
      setEndTime(draft.endTime || "");
      setHours(draft.hours || "");
      setHoursTouched(!!draft.hoursTouched);
      setFuel(draft.fuel || "");
      setStartMiles(draft.startMiles || "");
      setEndMiles(draft.endMiles || "");
      setRemarks(draft.remarks || "");
      setLoads(draft.loads?.length ? draft.loads : [newLoad(), newLoad()]);
      setTimeResetKey((k) => k + 1);
      setDraftRestored(true);
    } else if (draft) {
      // Stale empty draft from before this fix — clear it so it doesn't
      // keep tripping the restored banner on future visits.
      clearDraft(driverId);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the in-progress sheet to this device on every change. A draft
  // that's still just the defaults isn't worth persisting — it would only
  // trip the "restored" banner on the next visit for no reason.
  useEffect(() => {
    if (!hydrated) return;
    const draft: Draft = {
      date,
      truck,
      startTime,
      endTime,
      hours,
      hoursTouched,
      fuel,
      startMiles,
      endMiles,
      remarks,
      loads,
    };
    if (isBlankDraft(draft, defaultTruck)) {
      clearDraft(driverId);
    } else {
      saveDraft(driverId, draft);
    }
  }, [
    hydrated,
    driverId,
    defaultTruck,
    date,
    truck,
    startTime,
    endTime,
    hours,
    hoursTouched,
    fuel,
    startMiles,
    endMiles,
    remarks,
    loads,
  ]);

  // After a successful submit, clear the form for the next entry and
  // surface a dismissible confirmation banner. Adjusted during render
  // (React's recommended pattern) rather than in an effect, since this
  // reacts to `state` — a value already produced by this render.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) {
      setSavedDate(date);
      clearFields();
      setDismissed(false);
    }
  }

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

  const succeeded = !pending && !state.error && state !== initialState && !dismissed;

  return (
    <form action={formAction} className="flex flex-col gap-4">
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

      {draftRestored && !succeeded && (
        <div className="rounded-lg bg-accent-dim border border-accent/30 text-sm font-semibold px-4 py-3 flex items-center justify-between gap-3">
          <span>Restored your in-progress sheet from earlier this shift.</span>
          <button type="button" onClick={() => setDraftRestored(false)} className="text-xs underline font-bold">
            Dismiss
          </button>
        </div>
      )}
      {succeeded && (
        <div className="rounded-lg bg-good/10 border border-good/30 text-sm font-semibold px-4 py-3 flex items-center justify-between gap-3">
          <span>Sheet saved for {savedDate}.</span>
          <button type="button" onClick={() => setDismissed(true)} className="text-xs underline font-bold">
            Dismiss
          </button>
        </div>
      )}
      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <Card title="Shift">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
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
              placeholder="e.g. 14"
              className="input"
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
          <Field label="Start Time">
            <TimeInput
              key={`start-${timeResetKey}`}
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
              key={`end-${timeResetKey}`}
              name="end_time"
              defaultValue={endTime}
              onChange={(v) => {
                setEndTime(v);
                onStartEnd(startTime, v);
              }}
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
                    name={`load-${i}-job-arrival`}
                    defaultValue={row.jobSiteArrivalTime}
                    onChange={(v) => updateLoad(row.key, "jobSiteArrivalTime", v)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                    Job Site Departure
                  </span>
                  <TimeInput
                    name={`load-${i}-job-departure`}
                    defaultValue={row.jobSiteDepartureTime}
                    onChange={(v) => updateLoad(row.key, "jobSiteDepartureTime", v)}
                  />
                </div>
              </div>
              <textarea
                className="input-sm resize-y"
                placeholder="Note for this load (optional)"
                rows={2}
                value={row.note}
                onChange={(e) => updateLoad(row.key, "note", e.target.value)}
              />
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
        <button
          type="button"
          onClick={() => {
            clearFields();
            setDismissed(true);
          }}
          className="rounded-lg border border-border text-ink-2 font-bold text-sm px-5 py-2.5"
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Submit Sheet"}
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
