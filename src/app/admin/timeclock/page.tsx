import { createClient } from "@/lib/supabase/server";
import { TRUCK_NUMBERS } from "@/lib/loadOptions";
import { addDaysISO, currentWorkWeekRange, workWeekStartOf } from "@/lib/workWeek";
import TimeClockView, { type Punch } from "./TimeClockView";

export default async function TimeClockPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const weekStart = (week && workWeekStartOf(week)) || currentWorkWeekRange().startISO;
  const weekEnd = addDaysISO(weekStart, 6);

  const supabase = await createClient();
  const [{ data: punches }, { data: roster }] = await Promise.all([
    supabase
      .from("time_punches")
      .select("id, driver_id, driver_name, work_date, clock_in, clock_out, truck_number, company, job, ticket_number, edited")
      .gte("work_date", weekStart)
      .lte("work_date", weekEnd)
      .order("clock_in", { ascending: true }),
    supabase.from("drivers").select("id, full_name").order("full_name"),
  ]);

  return (
    <main className="max-w-5xl mx-auto px-5 py-7 flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Time Clock</h1>
        <p className="text-sm text-ink-2 mt-0.5">
          Clock-ins and clock-outs from the login page, with the truck and company for the day. Completed shifts
          feed the Pay Stubs page.
        </p>
      </div>
      <TimeClockView
        key={weekStart}
        punches={(punches ?? []) as Punch[]}
        roster={(roster ?? []) as { id: string; full_name: string }[]}
        trucks={TRUCK_NUMBERS}
        weekStart={weekStart}
        weekEnd={weekEnd}
        prevWeek={addDaysISO(weekStart, -7)}
        nextWeek={addDaysISO(weekStart, 7)}
        isCurrentWeek={weekStart === currentWorkWeekRange().startISO}
      />
    </main>
  );
}
