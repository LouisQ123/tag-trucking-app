"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { last10Digits } from "@/lib/phone";

export interface ActionState {
  error?: string;
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const identifier = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!identifier || !password) {
    return { error: "Enter your email or phone number, and password." };
  }

  // A phone number is just an alternate way to find the account's email —
  // we never use Supabase's native phone auth (that needs a paid SMS
  // provider we don't need, since we're not sending any OTP).
  let email = identifier;
  if (!identifier.includes("@")) {
    const inputDigits = last10Digits(identifier);
    if (inputDigits.length !== 10) return { error: "Incorrect email/phone or password." };

    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("email, phone")
      .not("phone", "is", null);
    const match = profiles?.find((p) => p.phone && last10Digits(p.phone) === inputDigits);
    if (!match?.email) return { error: "Incorrect email/phone or password." };
    email = match.email;
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Incorrect email/phone or password." };
  }

  redirect(next.startsWith("/") ? next : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }
  return {};
}
