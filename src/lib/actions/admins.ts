"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/phone";
import type { ActionState } from "@/lib/actions/auth";

function str(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createAdminUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const email = str(formData, "email");
  const password = str(formData, "password");
  const fullName = str(formData, "full_name");
  const phoneRaw = str(formData, "phone");

  if (!email || !fullName) return { error: "Name and email are required." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };

  // Phone sign-in is handled at the app level (phone -> email lookup), not
  // via Supabase's native phone auth — that requires a paid SMS provider we
  // don't need since we never send an OTP. Just validate the format here.
  if (phoneRaw && !toE164(phoneRaw)) {
    return { error: "Phone number must be a valid 10-digit US number." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "admin",
      phone: phoneRaw || null,
    },
  });

  if (error || !data.user) {
    return { error: error?.message || "Couldn't create the account." };
  }

  revalidatePath("/admin/team");
  redirect("/admin/team");
}

export async function updateAdminUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(formData, "id");
  if (!id) return { error: "Missing user id." };

  const email = str(formData, "email");
  const newPassword = str(formData, "new_password");
  const phoneRaw = str(formData, "phone");
  if (!email) return { error: "Email is required." };
  if (newPassword && newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  if (phoneRaw && !toE164(phoneRaw)) {
    return { error: "Phone number must be a valid 10-digit US number." };
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
      phone: phoneRaw || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/team");
  revalidatePath(`/admin/team/${id}`);
  return {};
}
