"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

interface LoadInput {
  jobSite: string;
  dumping: string;
  type: string;
  company: string;
}

function toNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  let loads: LoadInput[] = [];
  try {
    loads = JSON.parse(String(formData.get("loads") || "[]"));
  } catch {
    loads = [];
  }
  const cleanLoads = loads
    .map((l) => ({
      jobSite: (l.jobSite || "").trim(),
      dumping: (l.dumping || "").trim(),
      type: (l.type || "").trim(),
      company: (l.company || "").trim(),
    }))
    .filter((l) => l.jobSite || l.dumping || l.type || l.company);

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
      }))
    );
    if (loadsError) {
      return { error: loadsError.message };
    }
  }

  revalidatePath("/");
  return {};
}
