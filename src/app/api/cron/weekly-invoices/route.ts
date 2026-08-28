import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentWorkWeekRange, todayEasternISO } from "@/lib/workWeek";

// Vercel Cron calls this on a schedule (see vercel.json) with
// `Authorization: Bearer $CRON_SECRET` — reject anything else so this
// public URL can't be used to spam-generate invoices.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

interface TicketRow {
  id: string;
  client: string;
  total_hours: number | null;
  rate: number | null;
  tow_rate: number | null;
  tow_count: number | null;
}

function towAmount(t: TicketRow): number {
  return t.tow_rate !== null && t.tow_count !== null ? t.tow_rate * t.tow_count : 0;
}

function ticketTotal(t: TicketRow): number {
  return (t.rate !== null ? (t.total_hours ?? 0) * t.rate : 0) + towAmount(t);
}

function nextInvoiceNumber(existingNumeric: number[]): string {
  const max = existingNumeric.length ? Math.max(...existingNumeric) : 0;
  return String(max + 1);
}

// Every Friday: draft one invoice per client, covering only that client's
// tickets dated within the current Mon–Sun work week. Tickets outside that
// window (e.g. from a missed week) are left un-invoiced for manual
// handling — this job intentionally never reaches further back.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { startISO, endISO } = currentWorkWeekRange();

  const [{ data: tickets, error: ticketsError }, { data: clients, error: clientsError }, { data: existingInvoices, error: invError }] =
    await Promise.all([
      supabase
        .from("invoice_tickets")
        .select("id, client, total_hours, rate, tow_rate, tow_count, date")
        .is("invoice_id", null)
        .gte("date", startISO)
        .lte("date", endISO),
      supabase.from("clients").select("id, name"),
      supabase.from("invoices").select("invoice_no"),
    ]);

  if (ticketsError || clientsError || invError) {
    return NextResponse.json(
      { error: ticketsError?.message || clientsError?.message || invError?.message },
      { status: 500 }
    );
  }

  const ticketRows = (tickets ?? []) as TicketRow[];
  if (!ticketRows.length) {
    return NextResponse.json({ weekStart: startISO, weekEnd: endISO, created: [], skipped: [] });
  }

  const clientIdByName = new Map(
    ((clients ?? []) as { id: string; name: string }[]).map((c) => [c.name.trim().toLowerCase(), c.id])
  );

  const byClient = new Map<string, TicketRow[]>();
  ticketRows.forEach((t) => {
    const key = t.client.trim();
    if (!key) return;
    const list = byClient.get(key) ?? [];
    list.push(t);
    byClient.set(key, list);
  });

  const existingNumeric = ((existingInvoices ?? []) as { invoice_no: string }[])
    .map((i) => Number(i.invoice_no))
    .filter((n) => Number.isInteger(n) && n > 0);

  const dateISO = todayEasternISO();
  const created: { client: string; invoiceNo: string; total: number; ticketCount: number }[] = [];
  const skipped: string[] = [];

  for (const [clientName, ticketsForClient] of byClient) {
    const clientId = clientIdByName.get(clientName.toLowerCase());
    if (!clientId) {
      skipped.push(`${clientName} (no matching client on file)`);
      continue;
    }

    const total = Math.round(ticketsForClient.reduce((sum, t) => sum + ticketTotal(t), 0) * 100) / 100;
    const invoiceNo = nextInvoiceNumber(existingNumeric);
    existingNumeric.push(Number(invoiceNo));

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        date: dateISO,
        client_id: clientId,
        for_description: "Dump Truck Rental",
        terms: "Net 30 days",
        total,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !invoice) {
      skipped.push(`${clientName} (couldn't create invoice: ${insertError?.message ?? "unknown error"})`);
      continue;
    }

    const { error: linkError } = await supabase
      .from("invoice_tickets")
      .update({ invoice_id: invoice.id })
      .in(
        "id",
        ticketsForClient.map((t) => t.id)
      );

    if (linkError) {
      skipped.push(`${clientName} (invoice #${invoiceNo} created but couldn't link tickets: ${linkError.message})`);
      continue;
    }

    created.push({ client: clientName, invoiceNo, total, ticketCount: ticketsForClient.length });
  }

  return NextResponse.json({ weekStart: startISO, weekEnd: endISO, created, skipped });
}
