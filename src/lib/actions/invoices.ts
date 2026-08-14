"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/actions/auth";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Invoices store a total snapshot rather than computing it on every read —
// but a ticket's rate/hours can be edited (or the ticket removed) after the
// invoice was generated, so that snapshot must be kept in sync whenever a
// linked ticket changes, not just when it's explicitly un-invoiced.
async function recomputeInvoiceTotal(supabase: Supabase, invoiceId: string) {
  const { data: rows } = await supabase
    .from("invoice_tickets")
    .select("total_hours, rate, tow_rate, tow_count")
    .eq("invoice_id", invoiceId);

  const total = (rows ?? []).reduce((sum, t) => {
    const labor = t.total_hours !== null && t.rate !== null ? t.total_hours * t.rate : 0;
    const tow = t.tow_rate !== null && t.tow_count !== null ? t.tow_rate * t.tow_count : 0;
    return sum + labor + tow;
  }, 0);

  await supabase
    .from("invoices")
    .update({ total: Math.round(total * 100) / 100 })
    .eq("id", invoiceId);
}

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
    tow_rate: numOrNull(formData, "tow_rate"),
    tow_count: intOrNull(formData, "tow_count"),
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
  const { data: updated, error } = await supabase
    .from("invoice_tickets")
    .update(fields)
    .eq("id", id)
    .select("invoice_id")
    .single();
  if (error) return { error: error.message };

  if (updated?.invoice_id) await recomputeInvoiceTotal(supabase, updated.invoice_id);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  return {};
}

export async function deleteInvoiceTicket(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invoice_tickets")
    .select("invoice_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("invoice_tickets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (existing?.invoice_id) await recomputeInvoiceTotal(supabase, existing.invoice_id);

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/history");
}

// Un-invoices a ticket that was included by mistake — the ticket itself
// stays, it just becomes billable on a future invoice again.
export async function removeTicketFromInvoice(ticketId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoice_tickets")
    .select("invoice_id")
    .eq("id", ticketId)
    .single();
  const invoiceId = existing?.invoice_id;
  if (!invoiceId) return;

  const { error } = await supabase
    .from("invoice_tickets")
    .update({ invoice_id: null })
    .eq("id", ticketId);
  if (error) throw new Error(error.message);

  await recomputeInvoiceTotal(supabase, invoiceId);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/history/${invoiceId}`);
  revalidatePath("/admin/invoices/history");
}

// Deleting the invoice record itself — its tickets aren't deleted, they're
// automatically un-invoiced (invoice_tickets.invoice_id references invoices
// with ON DELETE SET NULL) and become billable again.
export async function deleteInvoiceRecord(invoiceId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/history");
}

export async function updateInvoiceStatus(invoiceId: string, status: "pending" | "paid", checkNumber: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status,
      // A check number only means something once the invoice is marked
      // paid — clear it going back to pending so it can't show stale.
      check_number: status === "paid" ? checkNumber.trim() || null : null,
    })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/invoices/history");
  revalidatePath(`/admin/invoices/history/${invoiceId}`);
}

export interface SaveInvoiceInput {
  invoiceId?: string; // present when updating an existing draft
  clientId: string;
  invoiceNo: string;
  date: string;
  customer: string;
  forDescription: string;
  terms: string;
  ticketIds: string[];
  total: number;
  status: "draft" | "pending";
}

// Backs both "Save Draft" (status: "draft", can be revisited and changed
// later) and "Generate Invoice PDF" (status: "pending", the finalized send)
// — the same function either updates a draft in place or inserts a new
// invoice, so re-saving a draft never creates duplicate rows.
export async function saveInvoice(input: SaveInvoiceInput): Promise<{ id: string } | { error: string }> {
  await requireAdmin();

  if (!input.clientId || !input.invoiceNo || !input.date) {
    return { error: "Client, invoice number, and date are required." };
  }
  if (input.status === "pending" && !input.ticketIds.length) {
    return { error: "Select at least one ticket to bill." };
  }

  const supabase = await createClient();
  const fields = {
    invoice_no: input.invoiceNo,
    date: input.date,
    client_id: input.clientId,
    customer: input.customer || null,
    for_description: input.forDescription || null,
    terms: input.terms || "Net 30 days",
    total: input.total,
    status: input.status,
  };

  let invoiceId = input.invoiceId;

  if (invoiceId) {
    const { error } = await supabase.from("invoices").update(fields).eq("id", invoiceId);
    if (error) return { error: error.message };

    // Full-replace the ticket links — same pattern as replacing a sheet's
    // loads on edit — rather than diffing which tickets were added/removed.
    const { error: unlinkError } = await supabase
      .from("invoice_tickets")
      .update({ invoice_id: null })
      .eq("invoice_id", invoiceId);
    if (unlinkError) return { error: unlinkError.message };
  } else {
    const { data: invoice, error } = await supabase.from("invoices").insert(fields).select("id").single();
    if (error || !invoice) return { error: error?.message || "Couldn't save the invoice. Try again." };
    invoiceId = invoice.id as string;
  }

  if (input.ticketIds.length) {
    const { error: linkError } = await supabase
      .from("invoice_tickets")
      .update({ invoice_id: invoiceId })
      .in("id", input.ticketIds);
    if (linkError) return { error: linkError.message };
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/history");
  revalidatePath(`/admin/invoices/history/${invoiceId}`);
  return { id: invoiceId as string };
}
