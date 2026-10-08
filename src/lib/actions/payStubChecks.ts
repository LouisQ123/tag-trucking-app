"use server";

import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

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
