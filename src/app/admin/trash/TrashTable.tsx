"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductionSheet } from "@/lib/types/database";
import { restoreSheet } from "@/lib/actions/admin";

export default function TrashTable({ sheets }: { sheets: ProductionSheet[] }) {
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await restoreSheet(id);
      router.refresh();
    } finally {
      setRestoringId(null);
    }
  }

  if (!sheets.length) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-xl text-ink-2">
        <h2 className="text-base font-extrabold text-ink mb-1.5">Trash is empty</h2>
        <p className="text-sm">Sheets removed from the dashboard will show up here.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Driver</th>
              <th className="px-4 py-2.5">Truck</th>
              <th className="px-4 py-2.5">Loads</th>
              <th className="px-4 py-2.5">Deleted</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.id} className="border-t border-grid tabular-nums">
                <td className="px-4 py-3">{s.date}</td>
                <td className="px-4 py-3 font-semibold">{s.profiles?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{s.truck_number}</td>
                <td className="px-4 py-3">{s.loads?.length ?? 0}</td>
                <td className="px-4 py-3">
                  {s.deleted_at ? new Date(s.deleted_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleRestore(s.id)}
                    disabled={restoringId === s.id}
                    className="text-xs font-bold text-accent border border-accent/40 rounded-md px-3 py-1.5 disabled:opacity-60"
                  >
                    {restoringId === s.id ? "Restoring…" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
