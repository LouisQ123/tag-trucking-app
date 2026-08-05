import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types/database";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").order("name");
  const clients = (data as Client[]) ?? [];

  return (
    <main className="max-w-5xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Clients</h1>
          <p className="text-sm text-ink-2 mt-0.5">Billing contacts used on the &quot;Bill To&quot; box of an invoice.</p>
        </div>
        <Link
          href="/admin/clients/new"
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2.5"
        >
          + Add Client
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Address</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Default Rate</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-grid">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${c.id}`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {c.address_line1 || c.city_state_zip
                      ? `${c.address_line1 ?? ""}${c.address_line1 && c.city_state_zip ? ", " : ""}${c.city_state_zip ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {c.default_rate !== null ? `$${c.default_rate.toFixed(2)}/hr` : "—"}
                  </td>
                </tr>
              ))}
              {!clients.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-2">
                    No clients yet. Add your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
