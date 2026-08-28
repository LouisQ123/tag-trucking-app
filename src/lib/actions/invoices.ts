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

const SCAN_BUCKET = "ticket-scans";

// The browser uploads the scan file straight to Storage (see InvoiceEditor)
// — Vercel's serverless functions cap request bodies well under a real
// photo/PDF, so the file never passes through this server. This just
// points the ticket at the path the browser already wrote to, and cleans
// up whatever it's replacing so a ticket only ever holds one scan file.
async function applyScanPath(
  supabase: Supabase,
  formData: FormData,
  ticketId: string,
  previousPath?: string | null
): Promise<string | null> {
  const newPath = str(formData, "scan_path");
  if (!newPath || newPath === previousPath) return null;

  const { error } = await supabase.from("invoice_tickets").update({ scan_path: newPath }).eq("id", ticketId);
  if (error) return error.message;

  if (previousPath) await supabase.storage.from(SCAN_BUCKET).remove([previousPath]);
  return null;
}

export async function createInvoiceTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const fields = ticketFields(formData);
  if (!fields.date || !fields.client) return { error: "Date and client are required." };

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("invoice_tickets")
    .insert(fields)
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message || "Couldn't create the ticket. Try again." };

  const scanError = await applyScanPath(supabase, formData, inserted.id as string);
  if (scanError) {
    // Undo the insert so a failed scan doesn't leave an orphan ticket behind
    // — the user just sees "Create Ticket" fail outright, as expected.
    await supabase.from("invoice_tickets").delete().eq("id", inserted.id as string);
    return { error: scanError };
  }

  revalidatePath("/admin/invoices");
  redirect("/admin/invoices");
}

export interface CreateFromExtractionInput {
  ticketNo: string;
  date: string;
  client: string;
  locationProject: string;
  truckNumber: string;
  timeIn: string;
  timeOut: string;
  travelTimeHours: string;
  totalHours: string;
  loads: string;
  rate: string;
  towRate: string;
  towCount: string;
  scanPath: string;
}

// Same insert as createInvoiceTicket, but returns instead of redirecting —
// for creating one of several tickets detected on a single scan, where a
// redirect after the first one would abandon the rest of the review list.
// The scan path is passed straight through (not re-uploaded): every ticket
// pulled from the same scan shares that one file as its attachment.
export async function createTicketFromExtraction(
  input: CreateFromExtractionInput
): Promise<{ id: string } | { error: string }> {
  await requireAdmin();

  const date = input.date.trim();
  const client = input.client.trim();
  if (!date || !client) return { error: "Date and client are required." };

  const numOrNull = (v: string) => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const intOrNull = (v: string) => {
    const n = numOrNull(v);
    return n === null ? null : Math.round(n);
  };

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from("invoice_tickets")
    .insert({
      ticket_no: input.ticketNo.trim() || null,
      date,
      client,
      location_project: input.locationProject.trim() || null,
      truck_number: input.truckNumber.trim() || null,
      company_name: "ATG Trucking LLC",
      time_in: input.timeIn.trim() || null,
      time_out: input.timeOut.trim() || null,
      travel_time_hours: numOrNull(input.travelTimeHours),
      total_hours: numOrNull(input.totalHours),
      loads: intOrNull(input.loads),
      rate: numOrNull(input.rate),
      tow_rate: numOrNull(input.towRate),
      tow_count: intOrNull(input.towCount),
      scan_path: input.scanPath.trim() || null,
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: error?.message || "Couldn't create the ticket. Try again." };

  revalidatePath("/admin/invoices");
  return { id: inserted.id as string };
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
    .select("invoice_id, scan_path")
    .single();
  if (error) return { error: error.message };

  const scanError = await applyScanPath(supabase, formData, id, updated?.scan_path);
  if (scanError) return { error: scanError };

  if (updated?.invoice_id) await recomputeInvoiceTotal(supabase, updated.invoice_id);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  return {};
}

// Removes just the attached scan, leaving the rest of the ticket intact —
// for replacing a bad photo or clearing one added by mistake.
export async function removeTicketScan(ticketId: string, scanPath: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error: removeError } = await supabase.storage.from(SCAN_BUCKET).remove([scanPath]);
  if (removeError) throw new Error(removeError.message);

  const { error } = await supabase.from("invoice_tickets").update({ scan_path: null }).eq("id", ticketId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${ticketId}`);
}

export async function deleteInvoiceTicket(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invoice_tickets")
    .select("invoice_id, scan_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("invoice_tickets").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (existing?.scan_path) await supabase.storage.from(SCAN_BUCKET).remove([existing.scan_path]);
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

export interface UpdateInvoiceFieldsInput {
  clientId: string;
  invoiceNo: string;
  date: string;
  customer: string;
  forDescription: string;
  terms: string;
}

// Edits an invoice's own fields — client, invoice #, date, customer, for,
// terms — independent of its status or which tickets are linked to it.
export async function updateInvoiceFields(
  invoiceId: string,
  fields: UpdateInvoiceFieldsInput
): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();

  if (!fields.clientId || !fields.invoiceNo || !fields.date) {
    return { error: "Client, invoice number, and date are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      client_id: fields.clientId,
      invoice_no: fields.invoiceNo,
      date: fields.date,
      customer: fields.customer || null,
      for_description: fields.forDescription || null,
      terms: fields.terms || "Net 30 days",
    })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath("/admin/invoices/history");
  revalidatePath(`/admin/invoices/history/${invoiceId}`);
  return { ok: true };
}

// Adds tickets to an existing invoice — the counterpart to
// removeTicketFromInvoice, for fixing a ticket left off by mistake.
export async function addTicketsToInvoice(invoiceId: string, ticketIds: string[]) {
  await requireAdmin();
  if (!ticketIds.length) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_tickets")
    .update({ invoice_id: invoiceId })
    .in("id", ticketIds);
  if (error) throw new Error(error.message);

  await recomputeInvoiceTotal(supabase, invoiceId);

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/history");
  revalidatePath(`/admin/invoices/history/${invoiceId}`);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: "pending" | "paid",
  checkNumber: string,
  checkReceivedDate: string
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      status,
      // A check number/date only mean something once the invoice is marked
      // paid — clear them going back to pending so they can't show stale.
      check_number: status === "paid" ? checkNumber.trim() || null : null,
      check_received_date: status === "paid" ? checkReceivedDate || null : null,
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

export interface CreateLegacyInvoiceInput {
  clientId: string;
  invoiceNo: string;
  date: string;
  total: number;
  status: "pending" | "paid";
  checkNumber: string;
  checkReceivedDate: string;
}

// A billing record from before this app tracked invoices — entered by hand
// so it still counts toward a client's balance, with no tickets attached
// since none exist for it.
export async function createLegacyInvoice(
  input: CreateLegacyInvoiceInput
): Promise<{ id: string } | { error: string }> {
  await requireAdmin();

  if (!input.clientId || !input.invoiceNo.trim() || !input.date) {
    return { error: "Client, invoice number, and date are required." };
  }
  if (!Number.isFinite(input.total) || input.total < 0) {
    return { error: "Enter a valid amount." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      invoice_no: input.invoiceNo.trim(),
      date: input.date,
      client_id: input.clientId,
      total: input.total,
      status: input.status,
      for_description: "Prior balance (added manually)",
      check_number: input.status === "paid" ? input.checkNumber.trim() || null : null,
      check_received_date: input.status === "paid" ? input.checkReceivedDate || null : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "Couldn't add the invoice. Try again." };

  revalidatePath("/admin/balances");
  revalidatePath("/admin/invoices/history");
  return { id: data.id as string };
}
