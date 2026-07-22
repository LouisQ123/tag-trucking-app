"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import type { ActionState } from "@/lib/actions/auth";

interface LoadInput {
  jobSite: string;
  dumping: string;
  type: string;
  company: string;
  arrivalTime: string;
  departureTime: string;
}

function toNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseLoads(formData: FormData): LoadInput[] {
  let loads: LoadInput[] = [];
  try {
    loads = JSON.parse(String(formData.get("loads") || "[]"));
  } catch {
    loads = [];
  }
  return loads
    .map((l) => ({
      jobSite: (l.jobSite || "").trim(),
      dumping: (l.dumping || "").trim(),
      type: (l.type || "").trim(),
      company: (l.company || "").trim(),
      arrivalTime: (l.arrivalTime || "").trim(),
      departureTime: (l.departureTime || "").trim(),
    }))
    .filter((l) => l.jobSite || l.dumping || l.type || l.company || l.arrivalTime || l.departureTime);
}

export async function submitSheet(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired — please sign in again." };

  const date = String(formData.get("date") || "");
  const truckNumber = String(formData.get("truck_number") || "").trim();
  if (!date || !truckNumber) {
    return { error: "Date and truck number are required." };
  }

  const startMiles = toNumberOrNull(formData.get("start_miles"));
  const endMiles = toNumberOrNull(formData.get("end_miles"));
  if (startMiles !== null && endMiles !== null && endMiles < startMiles) {
    return { error: "End miles can't be less than start miles." };
  }

  const cleanLoads = parseLoads(formData);

  const { data: sheet, error: sheetError } = await supabase
    .from("production_sheets")
    .insert({
      driver_id: user.id,
      date,
      truck_number: truckNumber,
      start_time: String(formData.get("start_time") || "") || null,
      end_time: String(formData.get("end_time") || "") || null,
      hours: toNumberOrNull(formData.get("hours")),
      fuel_gallons: toNumberOrNull(formData.get("fuel_gallons")),
      start_miles: startMiles,
      end_miles: endMiles,
      remarks: String(formData.get("remarks") || "").trim() || null,
    })
    .select("id")
    .single();

  if (sheetError || !sheet) {
    return { error: sheetError?.message || "Couldn't save the sheet. Try again." };
  }

  if (cleanLoads.length) {
    const { error: loadsError } = await supabase.from("loads").insert(
      cleanLoads.map((l) => ({
        sheet_id: sheet.id,
        job_site: l.jobSite || null,
        dumping: l.dumping || null,
        type: l.type || null,
        company: l.company || null,
        arrival_time: l.arrivalTime || null,
        departure_time: l.departureTime || null,
      }))
    );
    if (loadsError) {
      return { error: loadsError.message };
    }
  }

  revalidatePath("/");
  return {};
}

export async function updateSheet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const driverId = String(formData.get("driver_id") || "");
  const date = String(formData.get("date") || "");
  const truckNumber = String(formData.get("truck_number") || "").trim();
  if (!id || !driverId || !date || !truckNumber) {
    return { error: "Driver, date, and truck number are required." };
  }

  const startMiles = toNumberOrNull(formData.get("start_miles"));
  const endMiles = toNumberOrNull(formData.get("end_miles"));
  if (startMiles !== null && endMiles !== null && endMiles < startMiles) {
    return { error: "End miles can't be less than start miles." };
  }

  const cleanLoads = parseLoads(formData);
  const supabase = await createClient();

  const { error: sheetError } = await supabase
    .from("production_sheets")
    .update({
      driver_id: driverId,
      date,
      truck_number: truckNumber,
      start_time: String(formData.get("start_time") || "") || null,
      end_time: String(formData.get("end_time") || "") || null,
      hours: toNumberOrNull(formData.get("hours")),
      fuel_gallons: toNumberOrNull(formData.get("fuel_gallons")),
      start_miles: startMiles,
      end_miles: endMiles,
      remarks: String(formData.get("remarks") || "").trim() || null,
    })
    .eq("id", id);

  if (sheetError) return { error: sheetError.message };

  // Full-replace the loads rather than diffing — simpler and matches how
  // the sheet was originally submitted.
  const { error: deleteError } = await supabase.from("loads").delete().eq("sheet_id", id);
  if (deleteError) return { error: deleteError.message };

  if (cleanLoads.length) {
    const { error: loadsError } = await supabase.from("loads").insert(
      cleanLoads.map((l) => ({
        sheet_id: id,
        job_site: l.jobSite || null,
        dumping: l.dumping || null,
        type: l.type || null,
        company: l.company || null,
        arrival_time: l.arrivalTime || null,
        departure_time: l.departureTime || null,
      }))
    );
    if (loadsError) return { error: loadsError.message };
  }

  revalidatePath("/admin");
  redirect("/admin");
}
