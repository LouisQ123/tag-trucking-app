"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addPunch, deletePunch, updatePunch, type PunchInput } from "@/lib/actions/timeclock";
import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";

export interface Punch {
  id: string;
  driver_id: string | null;
  driver_name: string;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  truck_number: string | null;
  company: string | null;
  edited: boolean;
}

const TZ = "America/New_York";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}
function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
function fmtDay(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtRange(startISO: string, endISO: string): string {
  const f = (iso: string, withYear: boolean) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  };
  return `${f(startISO, false)} – ${f(endISO, true)}`;
}
function hoursOf(p: Punch): number | null {
  if (!p.clock_out) return null;
  return Math.round(((new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 3600000) * 100) / 100;
}

export default function TimeClockView({
  punches,
  roster,
  trucks,
  companies,
  weekStart,
  weekEnd,
  prevWeek,
  nextWeek,
  isCurrentWeek,
}: {
  punches: Punch[];
  roster: { id: string; full_name: string }[];
  trucks: string[];
  companies: string[];
  weekStart: string;
  weekEnd: string;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = new Map<string, { name: string; punches: Punch[] }>();
  for (const p of punches) {
    const key = p.driver_id ?? p.driver_name;
    const g = groups.get(key) ?? { name: p.driver_name, punches: [] };
    g.punches.push(p);
    groups.set(key, g);
  }
  const drivers = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));

  async function remove(p: Punch) {
    if (!confirm(`Delete ${p.driver_name}'s punch on ${fmtDay(p.work_date)}?`)) return;
    setError(null);
    const result = await deletePunch(p.id);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const totalHours = punches.reduce((a, p) => a + (hoursOf(p) ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/timeclock?week=${prevWeek}`}
            className="rounded-lg border border-border text-ink font-bold text-sm px-3 py-2"
            aria-label="Previous week"
          >
            ←
          </Link>
          <div className="px-2 text-center">
            <p className="text-sm font-extrabold tabular-nums">{fmtRange(weekStart, weekEnd)}</p>
            <p className="text-[11px] text-muted font-bold uppercase tracking-wide">
              {isCurrentWeek ? "Current week" : "Work week"} · {Math.round(totalHours * 100) / 100} hrs
            </p>
          </div>
          <Link
            href={`/admin/timeclock?week=${nextWeek}`}
            className="rounded-lg border border-border text-ink font-bold text-sm px-3 py-2"
            aria-label="Next week"
          >
            →
          </Link>
          {!isCurrentWeek && (
            <Link href="/admin/timeclock" className="text-xs font-bold text-ink-2 hover:text-ink ml-1">
              This week
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg border border-border text-ink font-bold text-sm px-4 py-2.5"
        >
          {showAdd ? "Close" : "+ Add a missed punch"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <PunchForm
            roster={roster}
            trucks={trucks}
            companies={companies}
            initial={{ date: weekStart, timeIn: "", timeOut: "", truck: "", company: "" }}
            submitLabel="Add punch"
            onSubmit={async (driverId, input) => {
              const result = await addPunch(driverId, input);
              if (!("error" in result)) {
                setShowAdd(false);
                router.refresh();
              }
              return result;
            }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {drivers.length === 0 && (
        <div className="bg-surface border border-border rounded-xl px-4 py-10 text-center text-ink-2 text-sm">
          No punches this work week.
        </div>
      )}

      {drivers.map((g) => {
        const sum = g.punches.reduce((a, p) => a + (hoursOf(p) ?? 0), 0);
        return (
          <div key={g.name} className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-grid">
              <p className="font-bold">{g.name}</p>
              <p className="text-sm font-extrabold text-accent tabular-nums">{Math.round(sum * 100) / 100} hrs</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                    <th className="px-4 py-2">Day</th>
                    <th className="px-4 py-2">In</th>
                    <th className="px-4 py-2">Out</th>
                    <th className="px-4 py-2 text-right">Hours</th>
                    <th className="px-4 py-2">Truck</th>
                    <th className="px-4 py-2">Company</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {g.punches.map((p) => {
                    const hrs = hoursOf(p);
                    const stale = !p.clock_out && Date.now() - new Date(p.clock_in).getTime() > 16 * 3600000;
                    return (
                      <Fragment key={p.id}>
                        <tr className="border-t border-grid hover:bg-surface-2">
                          <td className="px-4 py-2.5 tabular-nums">{fmtDay(p.work_date)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{fmtTime(p.clock_in)}</td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {p.clock_out ? (
                              fmtTime(p.clock_out)
                            ) : (
                              <span className={`font-bold ${stale ? "text-warning" : "text-good"}`}>
                                {stale ? "Missed clock-out?" : "Still in"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                            {hrs !== null ? hrs : "—"}
                            {hrs !== null && hrs > 14 && (
                              <span className="ml-1.5 text-[9.5px] font-extrabold uppercase text-warning">Long</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">{p.truck_number ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {p.company ?? "—"}
                            {p.edited && <span className="ml-1.5 text-[9.5px] font-bold uppercase text-muted">edited</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                              className="text-xs font-bold text-ink-2 hover:text-ink mr-3"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(p)}
                              className="text-xs font-bold text-critical/70 hover:text-critical"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                        {editingId === p.id && (
                          <tr className="border-t border-grid bg-surface-2/50">
                            <td colSpan={7} className="px-4 py-3">
                              <PunchForm
                                trucks={trucks}
                                companies={companies}
                                initial={{
                                  date: p.work_date,
                                  timeIn: hhmm(p.clock_in),
                                  timeOut: p.clock_out ? hhmm(p.clock_out) : "",
                                  truck: p.truck_number ?? "",
                                  company: p.company ?? "",
                                }}
                                submitLabel="Save"
                                onSubmit={async (_driverId, input) => {
                                  const result = await updatePunch(p.id, input);
                                  if (!("error" in result)) {
                                    setEditingId(null);
                                    router.refresh();
                                  }
                                  return result;
                                }}
                                onCancel={() => setEditingId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PunchForm({
  roster,
  trucks,
  companies,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  roster?: { id: string; full_name: string }[];
  trucks: string[];
  companies: string[];
  initial: PunchInput;
  submitLabel: string;
  onSubmit: (driverId: string, input: PunchInput) => Promise<{ error: string } | { ok: true }>;
  onCancel: () => void;
}) {
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState(initial.date);
  const [timeIn, setTimeIn] = useState(initial.timeIn);
  const [timeOut, setTimeOut] = useState(initial.timeOut);
  const [truck, setTruck] = useState(initial.truck);
  const [company, setCompany] = useState(initial.company);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (roster && !driverId) {
      setErr("Pick who this punch is for.");
      return;
    }
    setSaving(true);
    const result = await onSubmit(driverId, { date, timeIn, timeOut, truck, company });
    setSaving(false);
    if ("error" in result) setErr(result.error);
  }

  const mini = "flex flex-col gap-1 min-w-0";
  const lab = "text-[10px] font-bold uppercase tracking-wide text-ink-2";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {roster && (
          <label className={mini}>
            <span className={lab}>Driver</span>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input-sm">
              <option value="">Choose…</option>
              {roster.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={mini}>
          <span className={lab}>Day</span>
          <DateInput
            name="punch-date"
            defaultValue={initial.date}
            onChange={setDate}
            className="input-sm flex items-center justify-between gap-1.5"
          />
        </div>
        <div className={mini}>
          <span className={lab}>In</span>
          <TimeInput name="punch-in" defaultValue={initial.timeIn} onChange={setTimeIn} />
        </div>
        <div className={mini}>
          <span className={lab}>Out (blank = still in)</span>
          <TimeInput name="punch-out" defaultValue={initial.timeOut} onChange={setTimeOut} />
        </div>
        <label className={mini}>
          <span className={lab}>Truck</span>
          <select value={truck} onChange={(e) => setTruck(e.target.value)} className="input-sm">
            <option value="">—</option>
            {[...new Set([...trucks, ...(truck ? [truck] : [])])].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={mini}>
          <span className={lab}>Company</span>
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="input-sm">
            <option value="">—</option>
            {[...new Set([...companies, ...(company ? [company] : [])])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err && <p className="text-sm font-semibold text-critical">{err}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-5 py-2 disabled:opacity-60"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-bold text-ink-2 hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  );
}
