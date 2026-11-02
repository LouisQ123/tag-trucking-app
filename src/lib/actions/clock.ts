"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { TRUCK_NUMBERS } from "@/lib/loadOptions";
import { easternDateOf } from "@/lib/workWeek";
import { pinMatches } from "@/lib/pin";
import { checkAtYard, type Position } from "@/lib/yard";

// PUBLIC actions behind the /clock page — there is no login here, so every
// action re-proves who's asking with the person's PIN, and talks to the
// database through the service role (the tables themselves stay admin-only).

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

interface DriverRow {
  id: string;
  full_name: string;
  pin_hash: string | null;
  pin_failed_count: number;
  pin_locked_until: string | null;
  clock_anywhere: boolean;
}

// Wrong name, no PIN set, and wrong PIN all read the same, so the page can't
// be used to find out who has a PIN.
const BAD_PIN = "That PIN isn't right.";

async function authenticate(
  driverId: string,
  pin: string
): Promise<{ driver: DriverRow } | { error: string }> {
  if (!driverId || !/^\d{4}$/.test(pin)) return { error: BAD_PIN };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("drivers")
    .select("id, full_name, pin_hash, pin_failed_count, pin_locked_until, clock_anywhere")
    .eq("id", driverId)
    .maybeSingle();
  const driver = data as DriverRow | null;
  if (!driver || !driver.pin_hash) return { error: BAD_PIN };

  if (driver.pin_locked_until && new Date(driver.pin_locked_until) > new Date()) {
    const mins = Math.ceil((new Date(driver.pin_locked_until).getTime() - Date.now()) / 60000);
    return { error: `Too many wrong tries. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  if (!pinMatches(pin, driver.pin_hash)) {
    const fails = driver.pin_failed_count + 1;
    await supabase
      .from("drivers")
      .update(
        fails >= MAX_FAILS
          ? { pin_failed_count: 0, pin_locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
          : { pin_failed_count: fails }
      )
      .eq("id", driver.id);
    return { error: fails >= MAX_FAILS ? `Too many wrong tries. Locked for ${LOCK_MINUTES} minutes.` : BAD_PIN };
  }

  if (driver.pin_failed_count > 0 || driver.pin_locked_until) {
    await supabase.from("drivers").update({ pin_failed_count: 0, pin_locked_until: null }).eq("id", driver.id);
  }
  return { driver };
}

// Clocking is limited to the yard: the phone sends its location with the
// request and the server checks it, so the page can't skip the rule. (Anyone
// determined can fake a phone's GPS — this stops the casual out-of-yard
// clock-in, not a deliberate spoof.) Someone flagged clock_anywhere is exempt.
function locationGate(driver: DriverRow, loc: Position | null): { error: string } | null {
  if (driver.clock_anywhere) return null;
  const result = checkAtYard(loc);
  return result.ok ? null : { error: result.reason };
}

// Only people who have a PIN can clock in, so only they're listed.
export async function getClockNames(): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("drivers")
    .select("id, full_name")
    .not("pin_hash", "is", null)
    .order("full_name");
  return ((data ?? []) as { id: string; full_name: string }[]).map((d) => ({ id: d.id, name: d.full_name }));
}

export interface OpenPunch {
  clockIn: string;
  truck: string | null;
  company: string | null;
  job: string | null;
  ticketNumber: string | null;
}

export interface ClockState {
  name: string;
  open: OpenPunch | null;
  trucks: string[];
}

async function loadState(driver: DriverRow): Promise<ClockState> {
  const supabase = createAdminClient();
  const { data: open } = await supabase
    .from("time_punches")
    .select("clock_in, truck_number, company, job, ticket_number")
    .eq("driver_id", driver.id)
    .is("clock_out", null)
    .maybeSingle();
  const row = open as {
    clock_in: string;
    truck_number: string | null;
    company: string | null;
    job: string | null;
    ticket_number: string | null;
  } | null;
  return {
    name: driver.full_name,
    open: row
      ? {
          clockIn: row.clock_in,
          truck: row.truck_number,
          company: row.company,
          job: row.job,
          ticketNumber: row.ticket_number,
        }
      : null,
    trucks: TRUCK_NUMBERS,
  };
}

export async function clockVerify(driverId: string, pin: string): Promise<{ error: string } | { state: ClockState }> {
  const auth = await authenticate(driverId, pin);
  if ("error" in auth) return auth;
  return { state: await loadState(auth.driver) };
}

export async function clockIn(
  driverId: string,
  pin: string,
  truck: string,
  company: string,
  job: string,
  ticketNumber: string,
  loc: Position | null
): Promise<{ error: string } | { state: ClockState }> {
  const auth = await authenticate(driverId, pin);
  if ("error" in auth) return auth;
  const blocked = locationGate(auth.driver, loc);
  if (blocked) return blocked;

  const truckValue = truck.trim();
  const companyValue = company.trim();
  const jobValue = job.trim();
  const ticketValue = ticketNumber.trim();
  if (!truckValue || !companyValue) return { error: "Pick your truck and type the company you're working for." };
  if (!jobValue) return { error: "Enter the job." };
  if (!ticketValue) return { error: "Enter your ticket number." };
  if (truckValue.length > 40 || companyValue.length > 80 || jobValue.length > 120 || ticketValue.length > 60) {
    return { error: "That's too long." };
  }

  const supabase = createAdminClient();
  const now = new Date();
  const { error } = await supabase.from("time_punches").insert({
    driver_id: auth.driver.id,
    driver_name: auth.driver.full_name,
    work_date: easternDateOf(now),
    clock_in: now.toISOString(),
    truck_number: truckValue,
    company: companyValue,
    job: jobValue || null,
    ticket_number: ticketValue || null,
  });
  if (error) {
    // The one-open-punch-per-person index fires if they're already in.
    if (error.code === "23505") return { error: "You're already clocked in." };
    return { error: "Couldn't clock you in. Try again." };
  }
  return { state: await loadState(auth.driver) };
}

// The ticket number is required. One typed here replaces the clock-in one;
// left blank, the one entered at clock-in is kept.
export async function clockOut(
  driverId: string,
  pin: string,
  ticketNumber: string,
  loc: Position | null
): Promise<{ error: string } | { state: ClockState; hours: number }> {
  const auth = await authenticate(driverId, pin);
  if ("error" in auth) return auth;
  const blocked = locationGate(auth.driver, loc);
  if (blocked) return blocked;

  const supabase = createAdminClient();
  const { data: open } = await supabase
    .from("time_punches")
    .select("id, clock_in, ticket_number")
    .eq("driver_id", auth.driver.id)
    .is("clock_out", null)
    .maybeSingle();
  const punch = open as { id: string; clock_in: string; ticket_number: string | null } | null;
  if (!punch) return { error: "You're not clocked in." };

  const ticketValue = ticketNumber.trim();
  if (ticketValue.length > 60) return { error: "That ticket number is too long." };
  if (!ticketValue && !punch.ticket_number) return { error: "Enter your ticket number." };

  const now = new Date();
  const { error } = await supabase
    .from("time_punches")
    .update(ticketValue ? { clock_out: now.toISOString(), ticket_number: ticketValue } : { clock_out: now.toISOString() })
    .eq("id", punch.id);
  if (error) return { error: "Couldn't clock you out. Try again." };

  const hours = Math.round(((now.getTime() - new Date(punch.clock_in).getTime()) / 3600000) * 100) / 100;
  return { state: await loadState(auth.driver), hours };
}
