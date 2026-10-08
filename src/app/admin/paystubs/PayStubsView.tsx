"use client";

import { useState } from "react";
import Link from "next/link";
import type { PayStub } from "@/lib/payStubs";
import { downloadPayStubsPdf } from "@/lib/payStubPdf";
import { savePayStubCheck, savePayStubPriorPayments } from "@/lib/actions/payStubChecks";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtRange(startISO: string, endISO: string): string {
  const fmt = (iso: string, withYear: boolean) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  };
  return `${fmt(startISO, false)} – ${fmt(endISO, true)}`;
}

export default function PayStubsView({
  stubs,
  weekStart,
  weekEnd,
  year,
  prevWeek,
  nextWeek,
  isCurrentWeek,
}: {
  stubs: PayStub[];
  weekStart: string;
  weekEnd: string;
  year: number;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What's typed in each Check # box, and what's actually saved — a box saves
  // when it loses focus, and only if it differs from what's already saved.
  const [typed, setTyped] = useState<Record<string, string>>(() =>
    Object.fromEntries(stubs.map((s) => [s.driverKey, s.checkNumber]))
  );
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(stubs.map((s) => [s.driverKey, s.checkNumber]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Prior payments: the box holds text while typing; `priorSaved` is the
  // last amount actually stored, which drives the YTD column and the PDF.
  const fmtPrior = (n: number) => (n === 0 ? "" : String(n));
  const [priorTyped, setPriorTyped] = useState<Record<string, string>>(() =>
    Object.fromEntries(stubs.map((s) => [s.driverKey, fmtPrior(s.priorPayments)]))
  );
  const [priorSaved, setPriorSaved] = useState<Record<string, number>>(() =>
    Object.fromEntries(stubs.map((s) => [s.driverKey, s.priorPayments]))
  );
  const [savingPriorKey, setSavingPriorKey] = useState<string | null>(null);

  async function commitPrior(s: PayStub) {
    const text = priorTyped[s.driverKey] ?? "";
    setSavingPriorKey(s.driverKey);
    setError(null);
    const result = await savePayStubPriorPayments(s.driverKey, year, text);
    setSavingPriorKey(null);
    if ("error" in result) {
      setError(`Couldn't save prior payments for ${s.driverName}: ${result.error}`);
      return;
    }
    setPriorSaved((prev) => ({ ...prev, [s.driverKey]: result.amount }));
    setPriorTyped((prev) => ({ ...prev, [s.driverKey]: fmtPrior(result.amount) }));
  }

  const withEdits = (s: PayStub): PayStub => {
    const prior = priorSaved[s.driverKey] ?? 0;
    return {
      ...s,
      checkNumber: (typed[s.driverKey] ?? "").trim(),
      priorPayments: prior,
      ytdGross: Math.round((s.ytdSheetsGross + prior) * 100) / 100,
    };
  };

  async function commitCheck(s: PayStub) {
    const value = (typed[s.driverKey] ?? "").trim();
    if (value === (saved[s.driverKey] ?? "")) return;
    setSavingKey(s.driverKey);
    setError(null);
    const result = await savePayStubCheck(s.driverKey, weekStart, value);
    setSavingKey(null);
    if ("error" in result) {
      setError(`Couldn't save the check number for ${s.driverName}: ${result.error}`);
      return;
    }
    setSaved((prev) => ({ ...prev, [s.driverKey]: value }));
    setTyped((prev) => ({ ...prev, [s.driverKey]: value }));
  }

  async function download(key: string, list: PayStub[]) {
    setBusy(key);
    setError(null);
    try {
      await downloadPayStubsPdf(list.map(withEdits));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the PDF.");
    } finally {
      setBusy(null);
    }
  }

  const totalGross = stubs.reduce((a, s) => a + s.grossPay, 0);
  const totalHours = stubs.reduce((a, s) => a + s.totalHours, 0);
  const missing = stubs.reduce((a, s) => a + s.missingRateCount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/paystubs?week=${prevWeek}`}
            className="rounded-lg border border-border text-ink font-bold text-sm px-3 py-2"
            aria-label="Previous week"
          >
            ←
          </Link>
          <div className="px-2 text-center">
            <p className="text-sm font-extrabold tabular-nums">{fmtRange(weekStart, weekEnd)}</p>
            <p className="text-[11px] text-muted font-bold uppercase tracking-wide">
              {isCurrentWeek ? "Current week (in progress)" : "Work week"}
            </p>
          </div>
          <Link
            href={`/admin/paystubs?week=${nextWeek}`}
            className="rounded-lg border border-border text-ink font-bold text-sm px-3 py-2"
            aria-label="Next week"
          >
            →
          </Link>
          {!isCurrentWeek && (
            <Link href="/admin/paystubs" className="text-xs font-bold text-ink-2 hover:text-ink ml-1">
              This week
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => download("all", stubs)}
          disabled={!stubs.length || busy !== null}
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2.5 disabled:opacity-60"
        >
          {busy === "all" ? "Generating…" : `Download All (${stubs.length})`}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-critical/10 border border-critical/30 text-sm font-semibold text-critical px-4 py-3">
          {error}
        </div>
      )}

      {missing > 0 && (
        <div className="rounded-lg bg-warning/15 border border-warning/30 text-sm font-semibold text-warning px-4 py-3">
          {missing} shift{missing === 1 ? "" : "s"} this week {missing === 1 ? "has" : "have"} no pay rate, so{" "}
          {missing === 1 ? "it isn't" : "they aren't"} priced on the stubs. Add the rate on the sheet and the stub
          updates.
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Contractor</th>
                <th className="px-4 py-2.5 text-right">Shifts</th>
                <th className="px-4 py-2.5 text-right">Hours</th>
                <th className="px-4 py-2.5 text-right">Gross pay</th>
                <th className="px-4 py-2.5">Paid earlier {year}</th>
                <th className="px-4 py-2.5 text-right">YTD gross</th>
                <th className="px-4 py-2.5">Check #</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {stubs.map((s) => (
                <tr key={s.driverName} className="border-t border-grid hover:bg-surface-2">
                  <td className="px-4 py-3 font-semibold">
                    {s.driverName}
                    {s.missingRateCount > 0 && (
                      <span className="ml-2 text-[9.5px] font-extrabold uppercase tracking-wide text-warning bg-warning/15 rounded px-1.5 py-0.5">
                        No rate
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.lines.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.totalHours}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{currency(s.grossPay)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={priorTyped[s.driverKey] ?? ""}
                        onChange={(e) => setPriorTyped((prev) => ({ ...prev, [s.driverKey]: e.target.value }))}
                        onBlur={() => {
                          const typedText = (priorTyped[s.driverKey] ?? "").replace(/[$,\s]/g, "");
                          const savedText = fmtPrior(priorSaved[s.driverKey] ?? 0);
                          if (typedText !== savedText) commitPrior(s);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        inputMode="decimal"
                        placeholder="$0.00"
                        aria-label={`Payments earlier in ${year} for ${s.driverName}`}
                        className="input-sm w-28"
                      />
                      {savingPriorKey === s.driverKey && (
                        <span className="text-[11px] font-semibold text-muted">Saving…</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-2 tabular-nums">
                    {currency(s.ytdSheetsGross + (priorSaved[s.driverKey] ?? 0))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={typed[s.driverKey] ?? ""}
                        onChange={(e) => setTyped((prev) => ({ ...prev, [s.driverKey]: e.target.value }))}
                        onBlur={() => commitCheck(s)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        placeholder="—"
                        aria-label={`Check number for ${s.driverName}`}
                        className="input-sm w-24"
                      />
                      {savingKey === s.driverKey ? (
                        <span className="text-[11px] font-semibold text-muted">Saving…</span>
                      ) : (
                        (saved[s.driverKey] ?? "") !== "" &&
                        saved[s.driverKey] === (typed[s.driverKey] ?? "").trim() && (
                          <span className="text-[11px] font-bold text-good">Saved</span>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => download(s.driverName, [s])}
                      disabled={busy !== null}
                      className="text-xs font-bold text-accent hover:underline disabled:opacity-50"
                    >
                      {busy === s.driverName ? "Generating…" : "Download PDF"}
                    </button>
                  </td>
                </tr>
              ))}
              {!stubs.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-ink-2">
                    No production sheets logged for this work week.
                  </td>
                </tr>
              )}
            </tbody>
            {stubs.length > 0 && (
              <tfoot>
                <tr className="border-t border-border text-[13px] font-extrabold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">{Math.round(totalHours * 100) / 100}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{currency(totalGross)}</td>
                  <td className="px-4 py-3" colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
