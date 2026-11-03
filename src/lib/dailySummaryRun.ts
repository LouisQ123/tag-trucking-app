import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/clockAlert";
import { buildDailySummary, type SummaryPunch } from "@/lib/dailySummary";

// Shared by the nightly cron and the "email today's summary" button, so both
// send exactly the same thing.
export async function sendDailySummaryFor(
  dateISO: string
): Promise<{ sent: true; drivers: number; totalHours: number } | { sent: false; reason?: string; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("time_punches")
    .select("driver_name, clock_in, clock_out, truck_number, company, job, ticket_number")
    .eq("work_date", dateISO);
  if (error) return { sent: false, error: error.message };

  const punches = (data ?? []) as SummaryPunch[];
  if (!punches.length) return { sent: false, reason: "No one clocked in today." };

  const summary = buildDailySummary(dateISO, punches);
  const result = await sendAlertEmail({ subject: summary.subject, text: summary.text, html: summary.html });
  if (!result.ok) return { sent: false, error: result.error };
  return { sent: true, drivers: summary.drivers, totalHours: summary.totalHours };
}
