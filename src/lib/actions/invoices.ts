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
function intOrNull(formData: FormData, key: string) {
  const n = numOrNull(formData, key);
  return n === null ? null : Math.round(n);
}
function timeOrNull(formData: FormData, key: string) {
  return str(formData, key) || null;
}

function ticketFields(formData: FormData) {
  return {
    ticket_no: str(formData, "ticket_no") || null,
    date: str(formData, "date"),
    client: str(formData, "client"),
    location_project: str(formData, "location_project") || null,
    truck_number: str(formData, "truck_number") || null,
    company_name: str(formData, "company_name") || "ATG Trucking LLC",
    time_in: timeOrNull(formData, "time_in"),
    time_out: timeOrNull(formData, "time_out"),
    travel_time_hours: numOrNull(formData, "travel_time_hours"),
    total_hours: numOrNull(formData, "total_hours"),
    loads: intOrNull(formData, "loads"),
    rate: numOrNull(formData, "rate"),
  };
}

export async function createInvoiceTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const fields = ticketFields(formData);
  if (!fields.date || !fields.client) return { error: "Date and client are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("invoice_tickets").insert(fields);
  if (error) return { error: error.message };

  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}

export async function updateInvoiceTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const id = str(formData, "id");
  const fields = ticketFields(formData);
  if (!id || !fields.date || !fields.client) return { error: "Date and client are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("invoice_tickets").update(fields).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  return {};
}

export async function deleteInvoiceTicket(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_tickets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invoices");
}

export interface GenerateInvoiceInput {
  clientId: string;
  invoiceNo: string;
  date: string;
  customer: string;
  forDescription: string;
  terms: string;
  ticketIds: string[];
  total: number;
}

export async function createInvoiceRecord(
  input: GenerateInvoiceInput
): Promise<{ id: string } | { error: string }> {
  await requireAdmin();

  if (!input.clientId || !input.invoiceNo || !input.date || !input.ticketIds.length) {
    return { error: "Client, invoice number, date, and at least one ticket are required." };
  }

  const supabase = await createClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_no: input.invoiceNo,
      date: input.date,
      client_id: input.clientId,
      customer: input.customer || null,
      for_description: input.forDescription || null,
      terms: input.terms || "Net 30 days",
      total: input.total,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    return { error: invoiceError?.message || "Couldn't create the invoice. Try again." };
  }

  const { error: ticketsError } = await supabase
    .from("invoice_tickets")
    .update({ invoice_id: invoice.id })
    .in("id", input.ticketIds);

  if (ticketsError) return { error: ticketsError.message };

  revalidatePath("/admin/invoices");
  return { id: invoice.id as string };
}
