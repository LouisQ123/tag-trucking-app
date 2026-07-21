"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toE164 } from "@/lib/phone";

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

  // Drivers can sign in with their phone number instead of email (admins
  // always use email — only driver accounts have a phone attached in Auth).
  const supabase = await createClient();
  let signInError: { message: string } | null;
  if (identifier.includes("@")) {
    ({ error: signInError } = await supabase.auth.signInWithPassword({ email: identifier, password }));
  } else {
    const phone = toE164(identifier);
    if (!phone) return { error: "Incorrect email/phone or password." };
    ({ error: signInError } = await supabase.auth.signInWithPassword({ phone, password }));
  }

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
