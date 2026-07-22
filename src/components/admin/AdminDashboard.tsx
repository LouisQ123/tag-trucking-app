"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProductionSheet } from "@/lib/types/database";
import BarList from "@/components/charts/BarList";
import TrendChart from "@/components/charts/TrendChart";
import { softDeleteSheet, exportAllData } from "@/lib/actions/admin";

const SERIES = { blue: "var(--series-blue)", green: "var(--series-green)", orange: "var(--accent)" };

type RangeKey = "today" | "7" | "30" | "all";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtShortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function inRange(dateISO: string, range: RangeKey) {
  if (range === "all") return true;
  const days = range === "today" ? 0 : Number(range);
  const d = new Date(dateISO + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round((now.getTime() - d.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= days;
}
function uniqSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
}
function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function AdminDashboard({ sheets }: { sheets: ProductionSheet[] }) {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("30");
  const [driverFilter, setDriverFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const drivers = useMemo(() => uniqSorted(sheets.map((s) => s.profiles?.full_name)), [sheets]);
  const companies = useMemo(
    () => uniqSorted(sheets.flatMap((s) => (s.loads ?? []).map((l) => l.company))),
    [sheets]
  );

  const filtered = useMemo(() => {
    return sheets.filter((s) => {
      if (!inRange(s.date, range)) return false;
      if (driverFilter !== "all" && s.profiles?.full_name !== driverFilter) return false;
      if (companyFilter !== "all") {
        const hasCo = (s.loads ?? []).some((l) => l.company === companyFilter);
        if (!hasCo) return false;
      }
      return true;
    });
  }, [sheets, range, driverFilter, companyFilter]);

  const [exporting, setExporting] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Move this production sheet to Trash? You can restore it later from Trash.")) return;
    setDeletingId(id);
    try {
      await softDeleteSheet(id);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atg-trucking-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (!sheets.length) {
    return (
      <div className="text-center py-16 px-5 border border-dashed border-border rounded-xl text-ink-2">
        <h2 className="text-base font-extrabold text-ink mb-1.5">No production sheets yet</h2>
        <p className="text-sm">Once drivers submit sheets, totals and charts will show up here.</p>
      </div>
    );
  }

  const totalLoads = filtered.reduce((a, s) => a + (s.loads?.length ?? 0), 0);
  const totalMiles = filtered.reduce((a, s) => a + (s.total_miles ?? 0), 0);
  const totalHours = filtered.reduce((a, s) => a + (s.hours ?? 0), 0);
  const totalFuel = filtered.reduce((a, s) => a + (s.fuel_gallons ?? 0), 0);
  const totalLaborCost = filtered.reduce((a, s) => a + (s.labor_cost ?? 0), 0);
  const avgMpg = totalFuel > 0 ? totalMiles / totalFuel : null;
  const activeDrivers = new Set(filtered.map((s) => s.profiles?.full_name).filter(Boolean)).size;

  const byDriverLoads = aggregate(filtered, (s) => s.profiles?.full_name, (s) => s.loads?.length ?? 0);
  const byDriverMiles = aggregate(filtered, (s) => s.profiles?.full_name, (s) => s.total_miles ?? 0);
  const byTruckMiles = aggregate(filtered, (s) => s.truck_number, (s) => s.total_miles ?? 0);
  const byCompanyLoads = aggregateLoads(filtered, (l) => l.company);
  const byDay = aggregateDay(filtered);
  const payroll = aggregatePayroll(filtered);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Fleet Dashboard</h1>
        <p className="text-sm text-ink-2 mt-0.5">Production, mileage, and payroll across the fleet.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 bg-surface border border-border rounded-xl px-3.5 py-3">
        <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-1">
          {(["today", "7", "30", "all"] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                range === r ? "bg-accent text-accent-ink" : "text-ink-2"
              }`}
            >
              {r === "today" ? "Today" : r === "all" ? "All" : `${r}D`}
            </button>
          ))}
        </div>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="text-sm rounded-md border border-border bg-page px-2.5 py-1.5"
        >
          <option value="all">All drivers</option>
          {drivers.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="text-sm rounded-md border border-border bg-page px-2.5 py-1.5"
        >
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Link
          href="/admin/trash"
          className="text-xs font-bold text-ink-2 hover:text-ink border border-border rounded-md px-3 py-1.5"
        >
          Trash
        </Link>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="text-xs font-bold text-ink-2 hover:text-ink border border-border rounded-md px-3 py-1.5 disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export All Data"}
        </button>
      </div>

      {!filtered.length ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl text-ink-2">
          <h2 className="text-base font-extrabold text-ink mb-1.5">No sheets match these filters</h2>
          <p className="text-sm">Try a wider date range or &quot;All drivers&quot;.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi label="Total Loads" value={totalLoads.toLocaleString()} sub={`${filtered.length} sheets`} />
            <Kpi label="Total Miles" value={totalMiles.toLocaleString()} unit="mi" />
            <Kpi label="Total Hours" value={round1(totalHours).toLocaleString()} unit="hrs" />
            <Kpi label="Avg Fuel Efficiency" value={avgMpg !== null ? String(round1(avgMpg)) : "—"} unit={avgMpg !== null ? "mpg" : ""} />
            <Kpi label="Active Drivers" value={activeDrivers.toLocaleString()} />
            <Kpi label="Labor Cost" value={currency(totalLaborCost)} accent />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <ChartCard title="Loads by Driver" caption="Count of loads logged, selected range">
              <BarList data={byDriverLoads} color={SERIES.blue} />
            </ChartCard>
            <ChartCard title="Miles by Driver" caption="Total miles driven, selected range">
              <BarList data={byDriverMiles} color={SERIES.green} unit="mi" />
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <ChartCard title="Miles by Truck" caption="Total miles driven, selected range">
              <BarList data={byTruckMiles} color={SERIES.blue} unit="mi" />
            </ChartCard>
            <ChartCard title="Loads by Company" caption="Which companies the fleet hauled for">
              <BarList data={byCompanyLoads} color={SERIES.orange} />
            </ChartCard>
          </div>
          <ChartCard title="Daily Load Volume" caption="Loads logged per day">
            <TrendChart points={byDay} color={SERIES.orange} unit=" loads" />
          </ChartCard>

          <div className="bg-surface border border-border rounded-xl p-4.5">
            <p className="text-[13px] font-extrabold mb-0.5">Payroll</p>
            <p className="text-[11.5px] text-muted mb-3.5">
              Hours logged &times; each driver&apos;s pay rate at the time of submission.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                    <th className="py-2">Driver</th>
                    <th className="py-2">Hours</th>
                    <th className="py-2">Effective Rate</th>
                    <th className="py-2">Labor Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.map((p) => (
                    <tr key={p.driver} className="border-t border-grid tabular-nums">
                      <td className="py-2 font-semibold">{p.driver}</td>
                      <td className="py-2">{round1(p.hours)}</td>
                      <td className="py-2">{p.hours > 0 ? `${currency(p.cost / p.hours)}/hr` : "—"}</td>
                      <td className="py-2 font-bold">{currency(p.cost)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-extrabold tabular-nums">
                    <td className="py-2">Total</td>
                    <td className="py-2">{round1(totalHours)}</td>
                    <td className="py-2"></td>
                    <td className="py-2">{currency(totalLaborCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-4.5">
            <p className="text-[13px] font-extrabold mb-0.5">Production Log</p>
            <p className="text-[11.5px] text-muted mb-3.5">
              {filtered.length} sheet{filtered.length === 1 ? "" : "s"} in view, most recent first
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Driver</th>
                    <th className="py-2 pr-3">Truck</th>
                    <th className="py-2 pr-3">Loads</th>
                    <th className="py-2 pr-3">Miles</th>
                    <th className="py-2 pr-3">MPG</th>
                    <th className="py-2 pr-3">Hours</th>
                    <th className="py-2 pr-3">Cost</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice()
                    .sort((a, b) => (b.date + b.submitted_at).localeCompare(a.date + a.submitted_at))
                    .map((s) => (
                      <tr key={s.id} className="border-t border-grid tabular-nums">
                        <td className="py-2 pr-3">{fmtDate(s.date)}</td>
                        <td className="py-2 pr-3 font-semibold">{s.profiles?.full_name ?? "—"}</td>
                        <td className="py-2 pr-3">{s.truck_number}</td>
                        <td className="py-2 pr-3">{s.loads?.length ?? 0}</td>
                        <td className="py-2 pr-3">{s.total_miles ?? "—"}</td>
                        <td className="py-2 pr-3">{s.mpg ?? "—"}</td>
                        <td className="py-2 pr-3">{s.hours ?? "—"}</td>
                        <td className="py-2 pr-3">{s.labor_cost !== null ? currency(s.labor_cost) : "—"}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/admin/sheets/${s.id}`}
                              className="w-6.5 h-6.5 rounded-md border border-border text-muted hover:text-ink hover:border-ink-2 text-xs flex items-center justify-center"
                              aria-label="Edit sheet"
                            >
                              ✎
                            </Link>
                            <button
                              onClick={() => handleDelete(s.id)}
                              disabled={deletingId === s.id}
                              className="w-6.5 h-6.5 rounded-md border border-border text-muted hover:text-critical hover:border-critical text-xs disabled:opacity-50"
                              aria-label="Move sheet to trash"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3.5 shadow-sm">
      <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted mb-2">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums tracking-tight ${accent ? "text-accent" : ""}`}>
        {value}
        {unit && <span className="text-[13px] font-bold text-ink-2 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-muted mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4.5">
      <p className="text-[13px] font-extrabold mb-0.5">{title}</p>
      <p className="text-[11.5px] text-muted mb-3.5">{caption}</p>
      {children}
    </div>
  );
}

function aggregate(
  sheets: ProductionSheet[],
  keyFn: (s: ProductionSheet) => string | null | undefined,
  valFn: (s: ProductionSheet) => number
) {
  const map = new Map<string, number>();
  for (const s of sheets) {
    const k = keyFn(s);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + valFn(s));
  }
  return Array.from(map, ([label, value]) => ({ label, value: round1(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function aggregateLoads(sheets: ProductionSheet[], keyFn: (l: { company: string | null }) => string | null) {
  const map = new Map<string, number>();
  for (const s of sheets) {
    for (const l of s.loads ?? []) {
      const k = keyFn(l);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return Array.from(map, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
}

function aggregateDay(sheets: ProductionSheet[]) {
  const map = new Map<string, number>();
  for (const s of sheets) {
    map.set(s.date, (map.get(s.date) ?? 0) + (s.loads?.length ?? 0));
  }
  return Array.from(map.keys())
    .sort()
    .map((d) => ({ label: fmtDate(d), shortLabel: fmtShortDate(d), value: map.get(d)! }));
}

function aggregatePayroll(sheets: ProductionSheet[]) {
  const map = new Map<string, { hours: number; cost: number }>();
  for (const s of sheets) {
    const driver = s.profiles?.full_name;
    if (!driver) continue;
    const entry = map.get(driver) ?? { hours: 0, cost: 0 };
    entry.hours += s.hours ?? 0;
    entry.cost += s.labor_cost ?? 0;
    map.set(driver, entry);
  }
  return Array.from(map, ([driver, v]) => ({ driver, hours: v.hours, cost: round2(v.cost) })).sort(
    (a, b) => b.cost - a.cost
  );
}
