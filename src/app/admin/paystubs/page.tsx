import { createClient } from "@/lib/supabase/server";
import { buildPayStubs, type PayAdjustment, type PayStubSheet, type RosterContact } from "@/lib/payStubs";
import { addDaysISO, currentWorkWeekRange, workWeekStartOf } from "@/lib/workWeek";
import PayStubsView from "./PayStubsView";

export default async function PayStubsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const weekStart = (week && workWeekStartOf(week)) || currentWorkWeekRange().startISO;
  const weekEnd = addDaysISO(weekStart, 6);

  // Year-to-date totals need every sheet from Jan 1 of the pay period's year.
  const yearStart = `${weekEnd.slice(0, 4)}-01-01`;
  const from = weekStart < yearStart ? weekStart : yearStart;

  const supabase = await createClient();
  const year = Number(weekEnd.slice(0, 4));
  const [{ data: sheets }, { data: roster }, { data: checkRows }, { data: priorRows }, { data: adjRows }] = await Promise.all([
    supabase
      .from("production_sheets")
      .select("driver_name, date, truck_number, hours, hourly_pay, labor_cost")
      .is("deleted_at", null)
      .gte("date", from)
      .lte("date", weekEnd),
    supabase.from("drivers").select("full_name, phone, hourly_pay"),
    supabase.from("pay_stub_checks").select("driver_key, check_number").eq("week_start", weekStart),
    supabase.from("pay_stub_prior_payments").select("driver_key, amount").eq("year", year),
    supabase
      .from("pay_stub_adjustments")
      .select("id, driver_key, driver_name, week_start, hours, rate, note")
      .gte("week_start", addDaysISO(from, -6))
      .lte("week_start", weekStart),
  ]);
  const adjustments: PayAdjustment[] = ((adjRows ?? []) as PayAdjustment[]).map((a) => ({
    ...a,
    hours: Number(a.hours),
    rate: a.rate === null ? null : Number(a.rate),
  }));
  const priors = Object.fromEntries(
    ((priorRows ?? []) as { driver_key: string; amount: number }[]).map((p) => [p.driver_key, Number(p.amount)])
  );
  const checks = Object.fromEntries(
    ((checkRows ?? []) as { driver_key: string; check_number: string }[]).map((c) => [c.driver_key, c.check_number])
  );

  const stubs = buildPayStubs((sheets ?? []) as PayStubSheet[], (roster ?? []) as RosterContact[], weekStart, checks, priors, adjustments);

  return (
    <main className="max-w-4xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Pay Stubs</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          1099 contractor pay statements for each Mon–Sun work week, built from the production sheets.
        </p>
      </div>
      <PayStubsView
        key={weekStart}
        stubs={stubs}
        weekStart={weekStart}
        weekEnd={weekEnd}
        year={year}
        rosterNames={((roster ?? []) as RosterContact[]).map((r) => r.full_name).sort((a, b) => a.localeCompare(b))}
        prevWeek={addDaysISO(weekStart, -7)}
        nextWeek={addDaysISO(weekStart, 7)}
        isCurrentWeek={weekStart === currentWorkWeekRange().startISO}
      />
    </main>
  );
}
