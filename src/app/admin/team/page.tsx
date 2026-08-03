import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  const profiles = (data as Profile[]) ?? [];

  return (
    <main className="max-w-3xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Team</h1>
          <p className="text-sm text-ink-2 mt-0.5">Admin accounts that can sign in to this app.</p>
        </div>
        <Link
          href="/admin/team/new"
          className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-4 py-2.5"
        >
          + Add Admin
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-grid">
                  <td className="px-4 py-3">
                    <Link href={`/admin/team/${p.id}`} className="font-semibold hover:underline">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2 tabular-nums">{p.phone ?? "—"}</td>
                </tr>
              ))}
              {!profiles.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-ink-2">
                    No admin accounts yet. Add your first one.
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
