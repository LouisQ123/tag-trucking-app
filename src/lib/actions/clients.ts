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

function clientFields(formData: FormData) {
  return {
    name: str(formData, "name"),
    company: str(formData, "company") || null,
    address_line1: str(formData, "address_line1") || null,
    city_state_zip: str(formData, "city_state_zip") || null,
    phone: str(formData, "phone") || null,
    fax: str(formData, "fax") || null,
    email: str(formData, "email") || null,
    default_rate: numOrNull(formData, "default_rate"),
  };
}

export async function createClientEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const fields = clientFields(formData);
  if (!fields.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(fields);

  if (error) {
    return { error: error.code === "23505" ? "A client with this name already exists." : error.message };
  }

  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

export async function updateClientEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = str(formData, "id");
  const fields = clientFields(formData);
  if (!id || !fields.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(fields).eq("id", id);

  if (error) {
    return { error: error.code === "23505" ? "A client with this name already exists." : error.message };
  }

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return {};
}

export async function deleteClientEntry(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/clients");
}
