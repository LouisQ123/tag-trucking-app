"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Invoice } from "@/lib/types/database";

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtDate(iso: string): string {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export interface InvoiceRow extends Invoice {
  clientName: string;
  ticketCount: number;
  isNew: boolean;
  submitByLabel: string;
}

type SortKey = "date" | "client";
type SortDir = "asc" | "desc";

export default function InvoiceHistoryTable({ rows }: { rows: InvoiceRow[] }) {
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
    const filtered = q ? rows.filter((r) => r.invoice_no.toLowerCase().includes(q)) : rows;
    const list = [...filtered];
    list.sort((a, b) => {
      // Sorting by client groups invoices for the same client together;
      // within a group, order by date so it reads chronologically.
      let cmp = sortKey === "date" ? a.date.localeCompare(b.date) : a.clientName.localeCompare(b.clientName);
      if (cmp === 0 && sortKey === "client") cmp = a.date.localeCompare(b.date);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortDir, search]);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by invoice #…"
        className="input sm:max-w-xs"
      />
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Invoice #</th>
              <SortHeader label="Date" sortKey="date" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Client" sortKey="client" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-2.5">Tickets</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((inv) => (
              <tr key={inv.id} className="border-t border-grid hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Link
                      href={
                        inv.status === "draft"
                          ? `/admin/invoices/generate?draft=${inv.id}`
                          : `/admin/invoices/history/${inv.id}`
                      }
                      className="font-semibold hover:underline inline-block min-w-[132px]"
                    >
                      #{inv.invoice_no}
                    </Link>
                    {inv.isNew && (
                      <>
                        <span className="shrink-0 text-[9.5px] font-extrabold uppercase tracking-wide text-accent-ink bg-accent rounded px-1.5 py-0.5">
                          New
                        </span>
                        <span className="shrink-0 text-[9.5px] font-extrabold uppercase tracking-wide text-warning bg-warning/15 rounded px-1.5 py-0.5">
                          Submit by {inv.submitByLabel}
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{fmtDate(inv.date)}</td>
                <td className="px-4 py-3">{inv.clientName}</td>
                <td className="px-4 py-3 tabular-nums">{inv.ticketCount}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{currency(inv.total)}</td>
                <td className="px-4 py-3">
                  {inv.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-good">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Paid{inv.check_number ? ` · Chk #${inv.check_number}` : ""}
                    </span>
                  ) : inv.status === "draft" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Draft
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning">
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-2">
                  {search ? "No invoices match that invoice #." : "No invoices generated yet."}
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
