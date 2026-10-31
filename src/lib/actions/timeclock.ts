"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { hashPin } from "@/lib/pin";
import { easternDateOf, easternInstant } from "@/lib/workWeek";

type Result = { error: string } | { ok: true };

export async function setDriverPin(driverId: string, pin: string): Promise<Result> {
  await requireAdmin();
  if (!driverId) return { error: "Pick a driver." };
  if (!/^\d{4}$/.test(pin)) return { error: "The PIN must be exactly 4 digits." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ pin_hash: hashPin(pin), pin_failed_count: 0, pin_locked_until: null })
    .eq("id", driverId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/roster/${driverId}`);
  return { ok: true };
}

export async function clearDriverPin(driverId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({ pin_hash: null, pin_failed_count: 0, pin_locked_until: null })
    .eq("id", driverId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/roster/${driverId}`);
  return { ok: true };
}

export interface PunchInput {
  date: string; // "YYYY-MM-DD" — the day they clocked in (Eastern)
  timeIn: string; // "HH:MM"
  timeOut: string; // "HH:MM" or "" for still clocked in
  truck: string;
  company: string;
  job: string;
  ticketNumber: string;
}

// Out earlier than in means the shift ran past midnight.
function instants(input: PunchInput): { clockIn: Date; clockOut: Date | null } | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{1,2}:\d{2}/.test(input.timeIn)) {
    return { error: "Enter the date and clock-in time." };
  }
  const clockIn = easternInstant(input.date, input.timeIn);
  if (!input.timeOut) return { clockIn, clockOut: null };
  let clockOut = easternInstant(input.date, input.timeOut);
  if (clockOut < clockIn) clockOut = new Date(clockOut.getTime() + 24 * 3600000);
  return { clockIn, clockOut };
}

export async function updatePunch(id: string, input: PunchInput): Promise<Result> {
  await requireAdmin();
  const times = instants(input);
  if ("error" in times) return times;

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_punches")
    .update({
      work_date: easternDateOf(times.clockIn),
      clock_in: times.clockIn.toISOString(),
      clock_out: times.clockOut ? times.clockOut.toISOString() : null,
      truck_number: input.truck.trim() || null,
      company: input.company.trim() || null,
      job: input.job.trim() || null,
      ticket_number: input.ticketNumber.trim() || null,
      edited: true,
    })
    .eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? "That person already has another open punch." : error.message };
  }
  revalidatePath("/admin/timeclock");
  revalidatePath("/admin/paystubs");
  return { ok: true };
}

export async function deletePunch(id: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("time_punches").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/timeclock");
  revalidatePath("/admin/paystubs");
  return { ok: true };
}

// For a missed punch — an admin adds the whole shift by hand.
export async function addPunch(driverId: string, input: PunchInput): Promise<Result> {
  await requireAdmin();
  const times = instants(input);
  if ("error" in times) return times;

  const supabase = await createClient();
  const { data: driver } = await supabase.from("drivers").select("id, full_name").eq("id", driverId).maybeSingle();
  if (!driver) return { error: "Pick a driver." };

  const { error } = await supabase.from("time_punches").insert({
    driver_id: driver.id,
    driver_name: driver.full_name,
    work_date: easternDateOf(times.clockIn),
    clock_in: times.clockIn.toISOString(),
    clock_out: times.clockOut ? times.clockOut.toISOString() : null,
    truck_number: input.truck.trim() || null,
    company: input.company.trim() || null,
    job: input.job.trim() || null,
    ticket_number: input.ticketNumber.trim() || null,
    edited: true,
  });
  if (error) {
    return { error: error.code === "23505" ? "That person is already clocked in." : error.message };
  }
  revalidatePath("/admin/timeclock");
  revalidatePath("/admin/paystubs");
  return { ok: true };
}
