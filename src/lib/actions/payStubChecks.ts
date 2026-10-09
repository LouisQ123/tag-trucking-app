"use server";

import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { driverKey } from "@/lib/payStubs";
import { workWeekStartOf } from "@/lib/workWeek";

// A blank check number clears it, so the field can be emptied to undo a typo.
export async function savePayStubCheck(
  driverKey: string,
  weekStart: string,
  checkNumber: string
): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  if (!driverKey || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: "Invalid pay stub." };

  const supabase = await createClient();
  const value = checkNumber.trim();

  if (!value) {
    const { error } = await supabase
      .from("pay_stub_checks")
      .delete()
      .eq("driver_key", driverKey)
      .eq("week_start", weekStart);
    return error ? { error: error.message } : { ok: true };
  }

  const { error } = await supabase
    .from("pay_stub_checks")
    .upsert({ driver_key: driverKey, week_start: weekStart, check_number: value }, { onConflict: "driver_key,week_start" });
  return error ? { error: error.message } : { ok: true };
}

// A blank amount clears it. Accepts "$1,234.50" style input.
export async function savePayStubPriorPayments(
  driverKey: string,
  year: number,
  amountText: string
): Promise<{ error: string } | { ok: true; amount: number }> {
  await requireAdmin();
  if (!driverKey || !Number.isInteger(year) || year < 2000 || year > 2100) return { error: "Invalid pay stub." };

  const supabase = await createClient();
  const cleaned = amountText.replace(/[$,\s]/g, "");

  if (!cleaned) {
    const { error } = await supabase
      .from("pay_stub_prior_payments")
      .delete()
      .eq("driver_key", driverKey)
      .eq("year", year);
    return error ? { error: error.message } : { ok: true, amount: 0 };
  }

  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return { error: "Enter a dollar amount, like 4250.00." };
  const rounded = Math.round(amount * 100) / 100;

  const { error } = await supabase
    .from("pay_stub_prior_payments")
    .upsert({ driver_key: driverKey, year, amount: rounded }, { onConflict: "driver_key,year" });
  return error ? { error: error.message } : { ok: true, amount: rounded };
}

export interface AddAdjustmentInput {
  driverName: string;
  weekStart: string;
  hours: number;
  rate: number | null;
  note: string;
}

// Hours added (+) or subtracted (−) on a driver's week, outside the sheets.
export async function addPayStubAdjustment(input: AddAdjustmentInput): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();

  const name = input.driverName.trim();
  const weekStart = workWeekStartOf(input.weekStart);
  if (!name || !weekStart) return { error: "Invalid pay stub." };
  if (!Number.isFinite(input.hours) || input.hours === 0) return { error: "Enter the hours to add or subtract (e.g. 2 or -1.5)." };
  if (Math.abs(input.hours) > 200) return { error: "That's too many hours for one adjustment." };
  if (input.rate !== null && (!Number.isFinite(input.rate) || input.rate < 0)) return { error: "Enter a valid rate." };

  const supabase = await createClient();
  const { error } = await supabase.from("pay_stub_adjustments").insert({
    driver_key: driverKey(name),
    driver_name: name,
    week_start: weekStart,
    hours: Math.round(input.hours * 100) / 100,
    rate: input.rate,
    note: input.note.trim() || null,
  });
  return error ? { error: error.message } : { ok: true };
}

export async function deletePayStubAdjustment(id: string): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("pay_stub_adjustments").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}
