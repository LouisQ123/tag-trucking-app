"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { InvoiceTicket } from "@/lib/types/database";

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function dayOfWeek(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: "short" }) : "—";
}
function fmtDate(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function fmtTime(v: string | null): string {
  if (!v) return "—";
  const [h, m] = v.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

type SortKey = "date" | "client";
type SortDir = "asc" | "desc";

export default function TicketsTable({
  tickets,
  invoiceNoById,
  hasTow,
}: {
  tickets: InvoiceTicket[];
  invoiceNoById: Map<string, string>;
  hasTow: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? tickets.filter((t) => (t.ticket_no ?? "").toLowerCase().includes(q)) : tickets;
    const rows = [...filtered];
    rows.sort((a, b) => {
      const cmp = sortKey === "date" ? a.date.localeCompare(b.date) : a.client.localeCompare(b.client);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [tickets, sortKey, sortDir, search]);

  const colCount = hasTow ? 14 : 13;

  return (
    <div className="flex flex-col gap-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by ticket #…"
        className="input sm:max-w-xs"
      />
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${hasTow ? "min-w-[1420px]" : "min-w-[1340px]"}`}>
          <thead>
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Day</th>
              <SortHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-2.5">No.</th>
              <SortHeader label="Client" sortKey="client" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-2.5">Location / Project</th>
              <th className="px-4 py-2.5">Truck #</th>
              <th className="px-4 py-2.5">Time In</th>
              <th className="px-4 py-2.5">Time Out</th>
              <th className="px-4 py-2.5">Travel</th>
              <th className="px-4 py-2.5">Total Hrs</th>
              <th className="px-4 py-2.5">Rate</th>
              <th className="px-4 py-2.5">Loads</th>
              {hasTow && <th className="px-4 py-2.5">Tow</th>}
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const invoiceNo = t.invoice_id ? invoiceNoById.get(t.invoice_id) : null;
              return (
                <tr key={t.id} className="border-t border-grid hover:bg-surface-2">
                  <td className="px-4 py-3 text-ink-2">{dayOfWeek(t.date)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <Link href={`/admin/invoices/${t.id}`} className="font-semibold hover:underline">
                      {fmtDate(t.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{t.ticket_no ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{t.client}</td>
                  <td className="px-4 py-3 text-ink-2">{t.location_project ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{t.truck_number ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{fmtTime(t.time_in)}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{fmtTime(t.time_out)}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{t.travel_time_hours ?? "—"}</td>
                  <td className="px-4 py-3 font-bold text-accent tabular-nums">{t.total_hours ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">
                    {t.rate !== null ? `$${t.rate.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{t.loads ?? "—"}</td>
                  {hasTow && (
                    <td className="px-4 py-3 text-ink-2 tabular-nums">
                      {t.tow_rate !== null && t.tow_count !== null
                        ? `$${(t.tow_rate * t.tow_count).toFixed(2)}`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {invoiceNo ? (
                      <Link
                        href={`/admin/invoices/history/${t.invoice_id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-good hover:underline"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        #{invoiceNo}
                      </Link>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted">Not invoiced</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-ink-2">
                  {search ? "No tickets match that ticket #." : "No invoice tickets yet. Create your first one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  return (
    <th className="px-4 py-2.5">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 font-bold uppercase tracking-wide text-[10.5px] ${
          active ? "text-ink" : "text-muted hover:text-ink"
        }`}
      >
        {label}
        <span className="text-[9px]">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
