"use client";

import { useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import type { ProductionSheet } from "@/lib/types/database";

type PeriodType = "weekly" | "monthly" | "quarterly" | "yearly";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function todayISO() {
  return toISO(new Date());
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function periodRange(type: PeriodType, refDate: Date) {
  if (type === "weekly") {
    const start = new Date(refDate);
    start.setDate(refDate.getDate() - refDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end, label: `Week of ${fmtShort(start)} – ${fmtShort(end)}` };
  }
  if (type === "monthly") {
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    return { start, end, label: `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}` };
  }
  if (type === "quarterly") {
    const q = Math.floor(refDate.getMonth() / 3);
    const start = new Date(refDate.getFullYear(), q * 3, 1);
    const end = new Date(refDate.getFullYear(), q * 3 + 3, 0);
    return {
      start,
      end,
      label: `Q${q + 1} ${start.getFullYear()} (${MONTH_LABELS[start.getMonth()]} – ${MONTH_LABELS[end.getMonth()]})`,
    };
  }
  const start = new Date(refDate.getFullYear(), 0, 1);
  const end = new Date(refDate.getFullYear(), 11, 31);
  return { start, end, label: `${start.getFullYear()}` };
}

export default function ReportsView({ sheets }: { sheets: ProductionSheet[] }) {
  const [periodType, setPeriodType] = useState<PeriodType>("monthly");
  const [refDate, setRefDate] = useState(todayISO());

  const { start, end, label } = useMemo(
    () => periodRange(periodType, parseISO(refDate)),
    [periodType, refDate]
  );

  const filtered = useMemo(() => {
    const startISO = toISO(start);
    const endISO = toISO(end);
    return sheets.filter((s) => s.date >= startISO && s.date <= endISO);
  }, [sheets, start, end]);

  const totalLoads = filtered.reduce((a, s) => a + (s.loads?.length ?? 0), 0);
  const totalMiles = filtered.reduce((a, s) => a + (s.total_miles ?? 0), 0);
  const totalHours = filtered.reduce((a, s) => a + (s.hours ?? 0), 0);
  const totalLaborCost = filtered.reduce((a, s) => a + (s.labor_cost ?? 0), 0);

  const byDriver = useMemo(() => {
    const map = new Map<string, { loads: number; miles: number; hours: number; cost: number }>();
    for (const s of filtered) {
      const entry = map.get(s.driver_name) ?? { loads: 0, miles: 0, hours: 0, cost: 0 };
      entry.loads += s.loads?.length ?? 0;
      entry.miles += s.total_miles ?? 0;
      entry.hours += s.hours ?? 0;
      entry.cost += s.labor_cost ?? 0;
      map.set(s.driver_name, entry);
    }
    return Array.from(map, ([driver, v]) => ({ driver, ...v, cost: round2(v.cost) })).sort(
      (a, b) => b.cost - a.cost
    );
  }, [filtered]);

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">
        <h1 className="text-xl font-extrabold tracking-tight">Reports</h1>
        <p className="text-sm text-ink-2 mt-0.5">Generate a printable summary for a pay period.</p>
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-3">
        <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-1">
          {(["weekly", "monthly", "quarterly", "yearly"] as PeriodType[]).map((t) => (
            <button
              key={t}
              onClick={() => setPeriodType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize ${
                periodType === t ? "bg-accent text-accent-ink" : "text-ink-2"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted font-bold">containing</span>
        <DateInput name="ref_date" defaultValue={refDate} onChange={setRefDate} />
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="rounded-md bg-accent text-accent-ink font-bold text-xs px-4 py-2"
        >
          Print Report
        </button>
      </div>

      {!filtered.length ? (
        <div className="print:hidden text-center py-16 border border-dashed border-border rounded-xl text-ink-2">
          <h2 className="text-base font-extrabold text-ink mb-1.5">No sheets in this period</h2>
          <p className="text-sm">Try a different {periodType.replace("ly", "")} or date.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-6 print:border-0 print:p-0">
          <div className="mb-5">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">
              ATG Trucking LLC — {periodType} Report
            </p>
            <h2 className="text-lg font-extrabold tracking-tight mt-0.5">{label}</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Kpi label="Labor Cost" value={currency(totalLaborCost)} accent />
            <Kpi label="Total Loads" value={totalLoads.toLocaleString()} />
            <Kpi label="Total Miles" value={totalMiles.toLocaleString()} unit="mi" />
            <Kpi label="Total Hours" value={round1(totalHours).toLocaleString()} unit="hrs" />
          </div>

          <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-3">
            By Driver
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Driver</th>
                  <th className="py-2 pr-3">Loads</th>
                  <th className="py-2 pr-3">Miles</th>
                  <th className="py-2 pr-3">Hours</th>
                  <th className="py-2 pr-3">Labor Cost</th>
                </tr>
              </thead>
              <tbody>
                {byDriver.map((d) => (
                  <tr key={d.driver} className="border-t border-grid tabular-nums">
                    <td className="py-2 pr-3 font-semibold">{d.driver}</td>
                    <td className="py-2 pr-3">{d.loads}</td>
                    <td className="py-2 pr-3">{d.miles.toLocaleString()}</td>
                    <td className="py-2 pr-3">{round1(d.hours)}</td>
                    <td className="py-2 pr-3 font-bold">{currency(d.cost)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-extrabold tabular-nums">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3">{totalLoads}</td>
                  <td className="py-2 pr-3">{totalMiles.toLocaleString()}</td>
                  <td className="py-2 pr-3">{round1(totalHours)}</td>
                  <td className="py-2 pr-3">{currency(totalLaborCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="hidden print:block text-[10px] text-muted mt-6">
            Generated {fmtShort(new Date())} — {filtered.length} sheet{filtered.length === 1 ? "" : "s"} in this period.
          </p>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="bg-page border border-border rounded-xl px-4 py-3.5 print:border print:border-grid">
      <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted mb-2">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${accent ? "text-accent" : ""}`}>
        {value}
        {unit && <span className="text-[13px] font-bold text-ink-2 ml-1">{unit}</span>}
      </p>
    </div>
  );
}
