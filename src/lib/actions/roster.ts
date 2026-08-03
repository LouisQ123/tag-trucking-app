"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

function str(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}
function numOrNull(formData: FormData, key: string) {
  const v = str(formData, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(formData: FormData, key: string) {
  return str(formData, key) || null;
}

export async function createDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const fullName = str(formData, "full_name");
  if (!fullName) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("drivers").insert({
    full_name: fullName,
    phone: str(formData, "phone") || null,
    hourly_pay: numOrNull(formData, "hourly_pay"),
    cdl_number: str(formData, "cdl_number") || null,
    license_expiration: dateOrNull(formData, "license_expiration"),
    medical_card_expiration: dateOrNull(formData, "medical_card_expiration"),
  });

  if (error) {
    return {
      error: error.code === "23505" ? "A driver with this name is already on the roster." : error.message,
    };
  }

  revalidatePath("/admin/roster");
  redirect("/admin/roster");
}

export async function updateDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = str(formData, "id");
  const fullName = str(formData, "full_name");
  if (!id || !fullName) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("drivers")
    .update({
      full_name: fullName,
      phone: str(formData, "phone") || null,
      hourly_pay: numOrNull(formData, "hourly_pay"),
      cdl_number: str(formData, "cdl_number") || null,
      license_expiration: dateOrNull(formData, "license_expiration"),
      medical_card_expiration: dateOrNull(formData, "medical_card_expiration"),
    })
    .eq("id", id);

  if (error) {
    return {
      error: error.code === "23505" ? "A driver with this name is already on the roster." : error.message,
    };
  }

  revalidatePath("/admin/roster");
  revalidatePath(`/admin/roster/${id}`);
  return {};
}

export async function deleteDriver(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/roster");
}
