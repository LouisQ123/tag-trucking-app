"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createSheet, updateSheet } from "@/lib/actions/sheets";
import { extractSheetFromPhotos, type ExtractedSheet } from "@/lib/actions/sheetPhotoExtraction";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActionState } from "@/lib/actions/auth";
import { DUMPING_LOCATIONS, MATERIAL_TYPES, COMPANIES, TRUCK_NUMBERS } from "@/lib/loadOptions";
import TimeInput from "@/components/TimeInput";
import DateInput from "@/components/DateInput";
import ComboInput from "@/components/ComboInput";
import type { ProductionSheet } from "@/lib/types/database";

const SHEET_PHOTOS_BUCKET = "sheet-photos";

// Normalizes any browser-decodable photo (including HEIC from iPhones) to a
// JPEG blob before upload, since Claude's vision API only accepts
// JPEG/PNG/GIF/WEBP — the source format off a phone camera is otherwise
// unpredictable.
async function normalizePhotoToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process the photo."))), "image/jpeg", 0.9);
  });
}

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

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const initialState: ActionState = {};

export default function SheetEditor({
  sheet,
  driverNameSuggestions,
  driverPayRates,
}: {
  sheet?: ProductionSheet;
  driverNameSuggestions: string[];
  driverPayRates: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState(sheet ? updateSheet : createSheet, initialState);
  const supabaseBrowser = useMemo(() => createSupabaseBrowserClient(), []);

  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [extractedBanner, setExtractedBanner] = useState(false);
  // DateInput/TimeInput manage their own value internally and only read
  // `defaultValue` on mount, so applying extracted values requires forcing
  // a remount rather than just updating props.
  const [formResetKey, setFormResetKey] = useState(0);

  const [driverName, setDriverName] = useState(sheet?.driver_name ?? "");
  const [date, setDate] = useState(sheet?.date ?? todayISO());
  const [truck, setTruck] = useState(sheet?.truck_number ?? "");
  const [hourlyPay, setHourlyPay] = useState(sheet?.hourly_pay !== null && sheet?.hourly_pay !== undefined ? String(sheet.hourly_pay) : "");
  const [hourlyPayTouched, setHourlyPayTouched] = useState(false);
  const [startTime, setStartTime] = useState(sheet?.start_time ?? "");
  const [endTime, setEndTime] = useState(sheet?.end_time ?? "");
  const [hours, setHours] = useState(sheet?.hours !== null && sheet?.hours !== undefined ? String(sheet.hours) : "");
  const [hoursTouched, setHoursTouched] = useState(false);
  const [fuel, setFuel] = useState(sheet?.fuel_gallons !== null && sheet?.fuel_gallons !== undefined ? String(sheet.fuel_gallons) : "");
  const [startMiles, setStartMiles] = useState(sheet?.start_miles !== null && sheet?.start_miles !== undefined ? String(sheet.start_miles) : "");
  const [endMiles, setEndMiles] = useState(sheet?.end_miles !== null && sheet?.end_miles !== undefined ? String(sheet.end_miles) : "");
  const [remarks, setRemarks] = useState(sheet?.remarks ?? "");
  // None of these four per-load fields have a persistent seed list that
  // covers everything an admin might type (job site and company have no
  // seed list at all; dumping/material have a fixed static list) — but
  // while they're still filling out this sheet, a value typed for one
  // load should be pickable for the next one instead of retyping it.
  // Cleared on successful submit, not persisted beyond this sheet.
  const [extraJobSites, setExtraJobSites] = useState<string[]>(() =>
    Array.from(new Set((sheet?.loads ?? []).map((l) => l.job_site).filter((v): v is string => !!v)))
  );
  const [extraDumpingLocations, setExtraDumpingLocations] = useState<string[]>(() =>
    Array.from(
      new Set(
        (sheet?.loads ?? [])
          .map((l) => l.dumping)
          .filter((v): v is string => !!v && !DUMPING_LOCATIONS.includes(v))
      )
    )
  );
  const [extraMaterialTypes, setExtraMaterialTypes] = useState<string[]>(() =>
    Array.from(
      new Set(
        (sheet?.loads ?? [])
          .map((l) => l.type)
          .filter((v): v is string => !!v && !MATERIAL_TYPES.includes(v))
      )
    )
  );
  const [extraCompanies, setExtraCompanies] = useState<string[]>(() =>
    Array.from(
      new Set(
        (sheet?.loads ?? [])
          .map((l) => l.company)
          .filter((v): v is string => !!v && !COMPANIES.includes(v))
      )
    )
  );
  const [loads, setLoads] = useState<LoadRow[]>(
    sheet?.loads?.length
      ? sheet.loads.map((l) => ({
          key: l.id,
          jobSite: l.job_site ?? "",
          dumping: l.dumping ?? "",
          type: l.type ?? "",
          company: l.company ?? "",
          jobSiteArrivalTime: l.job_site_arrival_time ?? "",
          jobSiteDepartureTime: l.job_site_departure_time ?? "",
          note: l.note ?? "",
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

  const laborCost = useMemo(() => {
    const h = Number(hours),
      r = Number(hourlyPay);
    if (!hours || !hourlyPay || r <= 0) return null;
    return Math.round(h * r * 100) / 100;
  }, [hours, hourlyPay]);

  function updateLoad(key: string, field: keyof LoadRow, value: string) {
    setLoads((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function onDriverChange(name: string) {
    setDriverName(name);
    if (!hourlyPayTouched && name in driverPayRates) {
      setHourlyPay(String(driverPayRates[name]));
    }
  }

  function applyExtracted(data: ExtractedSheet) {
    if (data.driverName) onDriverChange(data.driverName);
    if (data.date) setDate(data.date);
    if (data.truckNumber) setTruck(data.truckNumber);
    if (data.startTime) setStartTime(data.startTime);
    if (data.endTime) setEndTime(data.endTime);
    if (data.hours) {
      setHoursTouched(true);
      setHours(data.hours);
    } else if (data.startTime || data.endTime) {
      // No explicit hours on the sheet — derive it the same way manual
      // start/end entry does, since applying extracted values bypasses the
      // TimeInput onChange handlers that normally trigger this.
      onStartEnd(data.startTime || startTime, data.endTime || endTime);
    }
    if (data.fuelGallons) setFuel(data.fuelGallons);
    if (data.startMiles) setStartMiles(data.startMiles);
    if (data.endMiles) setEndMiles(data.endMiles);
    if (data.remarks) setRemarks(data.remarks);
    if (data.loads.length) {
      setLoads(
        data.loads.map((l) => ({
          key: Math.random().toString(36).slice(2),
          jobSite: l.jobSite,
          dumping: l.dumping,
          type: l.type,
          company: l.company,
          jobSiteArrivalTime: l.jobSiteArrivalTime,
          jobSiteDepartureTime: l.jobSiteDepartureTime,
          note: l.note,
        }))
      );
    }
    setFormResetKey((k) => k + 1);
    setExtractedBanner(true);
  }

  // Photos and PDF scans are uploaded straight from the browser to
  // Supabase Storage — same reasoning as ticket scans: Vercel's serverless
  // functions cap request bodies well under a real phone photo or scanned
  // PDF. The Server Action only ever receives the resulting paths and
  // deletes them after extraction.
  async function onPhotosSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";

    setPhotoError(null);
    setExtractedBanner(false);
    setUploadingPhotos(true);
    const uploadedPaths: string[] = [];
    let failure: string | null = null;
    for (const file of files) {
      try {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const blob = isPdf ? file : await normalizePhotoToJpeg(file);
        const path = isPdf
          ? `${crypto.randomUUID()}/${Date.now()}.pdf`
          : `${crypto.randomUUID()}/${Date.now()}.jpg`;
        const { error } = await supabaseBrowser.storage.from(SHEET_PHOTOS_BUCKET).upload(path, blob, {
          contentType: isPdf ? "application/pdf" : "image/jpeg",
        });
        if (error) throw new Error(error.message);
        uploadedPaths.push(path);
      } catch (err) {
        failure = err instanceof Error ? err.message : `Couldn't process ${file.name}.`;
        break;
      }
    }
    setUploadingPhotos(false);

    if (failure) {
      setPhotoError(failure);
      if (uploadedPaths.length) await supabaseBrowser.storage.from(SHEET_PHOTOS_BUCKET).remove(uploadedPaths);
      return;
    }

    setExtracting(true);
    const result = await extractSheetFromPhotos(uploadedPaths, driverNameSuggestions);
    setExtracting(false);
    if (result.error || !result.data) {
      setPhotoError(result.error || "Extraction failed.");
      return;
    }
    applyExtracted(result.data);
  }

  function commitJobSite(v: string) {
    const trimmed = v.trim();
    if (trimmed && !extraJobSites.includes(trimmed)) {
      setExtraJobSites((prev) => [...prev, trimmed]);
    }
  }
  function commitDumping(v: string) {
    const trimmed = v.trim();
    if (trimmed && !DUMPING_LOCATIONS.includes(trimmed) && !extraDumpingLocations.includes(trimmed)) {
      setExtraDumpingLocations((prev) => [...prev, trimmed]);
    }
  }
  function commitType(v: string) {
    const trimmed = v.trim();
    if (trimmed && !MATERIAL_TYPES.includes(trimmed) && !extraMaterialTypes.includes(trimmed)) {
      setExtraMaterialTypes((prev) => [...prev, trimmed]);
    }
  }
  function commitCompany(v: string) {
    const trimmed = v.trim();
    if (trimmed && !COMPANIES.includes(trimmed) && !extraCompanies.includes(trimmed)) {
      setExtraCompanies((prev) => [...prev, trimmed]);
    }
  }

  // Adjusted during render (React's recommended pattern), since this
  // reacts to `state` — a value already produced by this render. Only
  // matters for Edit Sheet, which stays on the page after saving; New
  // Sheet redirects away on success, which already resets everything.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) {
      setExtraJobSites([]);
      setExtraDumpingLocations([]);
      setExtraMaterialTypes([]);
      setExtraCompanies([]);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {sheet && <input type="hidden" name="id" value={sheet.id} />}
      <input type="hidden" name="loads" value={JSON.stringify(loads)} />

      {state.error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {state.error}
        </div>
      )}

      <Card title="Upload Photo or Scan">
        <div className="flex flex-col gap-2.5">
          <p className="text-[12.5px] text-ink-2">
            Snap a photo or upload a scanned PDF of the physical sheet and the fields below will be filled in
            automatically — review everything before saving.
          </p>
          <label className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-border hover:border-accent hover:text-accent text-ink-2 font-bold text-[13px] py-2.5 cursor-pointer">
            {uploadingPhotos ? "Uploading…" : extracting ? "Reading the sheet…" : "+ Upload photo(s) or PDF"}
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              capture="environment"
              className="hidden"
              disabled={uploadingPhotos || extracting}
              onChange={onPhotosSelected}
            />
          </label>
          {photoError && <p className="text-[12.5px] font-semibold text-critical">{photoError}</p>}
          {extractedBanner && !photoError && (
            <p className="text-[12.5px] font-semibold text-good">
              Extracted from photo — please review the fields below before saving.
            </p>
          )}
        </div>
      </Card>

      <Card title="Sheet">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
          <Field label="Driver">
            <ComboInput
              name="driver_name"
              required
              value={driverName}
              onChange={onDriverChange}
              suggestions={driverNameSuggestions}
              placeholder="Type or pick a name"
            />
          </Field>
          <Field label="Date">
            <DateInput key={formResetKey} name="date" defaultValue={date} onChange={setDate} required />
          </Field>
          <Field label="Truck Number">
            <ComboInput
              name="truck_number"
              required
              value={truck}
              onChange={setTruck}
              suggestions={TRUCK_NUMBERS}
            />
          </Field>
        </div>
      </Card>

      <Card title="Shift">
        <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3.5">
          <Field label="Start Time">
            <TimeInput
              key={formResetKey}
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
              key={formResetKey}
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

      <Card title="Pay">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          <Field label="Hourly Pay ($)">
            <input
              type="number"
              name="hourly_pay"
              min={0}
              step={0.25}
              value={hourlyPay}
              onChange={(e) => {
                setHourlyPayTouched(true);
                setHourlyPay(e.target.value);
              }}
              placeholder="0.00"
              className="input"
            />
          </Field>
          <Field label="Labor Cost">
            <div className="font-bold text-accent text-[15px] py-2 tabular-nums">
              {laborCost !== null ? `$${laborCost.toLocaleString()}` : "—"}
            </div>
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
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 mt-3.5">
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
                  className="w-8 h-8 rounded-md border border-border text-muted hover:text-critical hover:border-critical text-sm flex items-center justify-center flex-none"
                  aria-label="Remove load"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-col sm:grid sm:grid-cols-4 gap-2.5">
                <ComboInput
                  className="input-sm"
                  placeholder="Job site / plant"
                  value={row.jobSite}
                  onChange={(v) => updateLoad(row.key, "jobSite", v)}
                  onBlur={commitJobSite}
                  suggestions={extraJobSites}
                />
                <ComboInput
                  className="input-sm"
                  placeholder="Dumping location"
                  value={row.dumping}
                  onChange={(v) => updateLoad(row.key, "dumping", v)}
                  onBlur={commitDumping}
                  suggestions={[...DUMPING_LOCATIONS, ...extraDumpingLocations]}
                />
                <ComboInput
                  className="input-sm"
                  placeholder="Material type"
                  value={row.type}
                  onChange={(v) => updateLoad(row.key, "type", v)}
                  onBlur={commitType}
                  suggestions={[...MATERIAL_TYPES, ...extraMaterialTypes]}
                />
                <ComboInput
                  className="input-sm"
                  placeholder="Company"
                  value={row.company}
                  onChange={(v) => updateLoad(row.key, "company", v)}
                  onBlur={commitCompany}
                  suggestions={[...COMPANIES, ...extraCompanies]}
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
          {pending ? "Saving…" : sheet ? "Save Changes" : "Create Sheet"}
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
