"use client";

import { useState } from "react";
import Link from "next/link";
import type { PayStub } from "@/lib/payStubs";
import { downloadPayStubsPdf } from "@/lib/payStubPdf";

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
  prevWeek,
  nextWeek,
  isCurrentWeek,
}: {
  stubs: PayStub[];
  weekStart: string;
  weekEnd: string;
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(key: string, list: PayStub[]) {
    setBusy(key);
    setError(null);
    try {
      await downloadPayStubsPdf(list);
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
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Contractor</th>
                <th className="px-4 py-2.5 text-right">Shifts</th>
                <th className="px-4 py-2.5 text-right">Hours</th>
                <th className="px-4 py-2.5 text-right">Gross pay</th>
                <th className="px-4 py-2.5 text-right">YTD gross</th>
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
                  <td className="px-4 py-3 text-right text-ink-2 tabular-nums">{currency(s.ytdGross)}</td>
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
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-2">
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
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
