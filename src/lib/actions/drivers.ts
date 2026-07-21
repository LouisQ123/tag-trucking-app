"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const v = str(formData, key);
  return v || null;
}

export async function createDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const email = str(formData, "email");
  const password = str(formData, "password");
  const fullName = str(formData, "full_name");
  const role = str(formData, "role") === "admin" ? "admin" : "driver";

  if (!email || !fullName) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      truck_number: str(formData, "truck_number") || null,
      hourly_pay: str(formData, "hourly_pay") || null,
      cdl_number: str(formData, "cdl_number") || null,
      license_expiration: dateOrNull(formData, "license_expiration"),
      medical_card_expiration: dateOrNull(formData, "medical_card_expiration"),
      phone: str(formData, "phone") || null,
    },
  });

  if (error || !data.user) {
    return { error: error?.message || "Couldn't create the account." };
  }

  revalidatePath("/admin/drivers");
  redirect("/admin/drivers");
}

export async function updateDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(formData, "id");
  if (!id) return { error: "Missing driver id." };

  const email = str(formData, "email");
  const newPassword = str(formData, "new_password");
  if (!email) return { error: "Email is required." };
  if (newPassword && newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  // Email and password live on the auth user, not the profiles row — changing
  // them requires the service-role admin client, not the RLS-scoped one.
  const admin = createAdminClient();
  const authUpdate: { email: string; email_confirm: true; password?: string } = {
    email,
    email_confirm: true,
  };
  if (newPassword) authUpdate.password = newPassword;

  const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdate);
  if (authError) return { error: authError.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: str(formData, "full_name"),
      email,
      phone: str(formData, "phone") || null,
      truck_number: str(formData, "truck_number") || null,
      hourly_pay: numOrNull(formData, "hourly_pay"),
      cdl_number: str(formData, "cdl_number") || null,
      license_expiration: dateOrNull(formData, "license_expiration"),
      medical_card_expiration: dateOrNull(formData, "medical_card_expiration"),
      role: str(formData, "role") === "admin" ? "admin" : "driver",
      active: formData.get("active") === "on",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/drivers");
  revalidatePath(`/admin/drivers/${id}`);
  return {};
}
