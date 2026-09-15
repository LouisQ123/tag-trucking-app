"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ExtractedTicket } from "@/lib/actions/ticketScanExtraction";
import { compressScanFile } from "@/lib/scanCompression";
import { extractTicketsFromScan } from "@/lib/scanExtraction";
import { createTicketsFromExtractions, type CreateFromExtractionInput } from "@/lib/actions/invoices";
import { computeTotalHours } from "@/lib/ticketMath";
import BulkTicketRow, { type RowStatus } from "./BulkTicketRow";

const MAX_SCAN_BYTES = 20 * 1024 * 1024;

interface Row {
  key: string;
  ticket: ExtractedTicket;
  status: RowStatus;
  error: string | null;
  attachedToInvoiceNo: string | null;
}

function emptyRows(tickets: ExtractedTicket[]): Row[] {
  return tickets.map((t, i) => ({
    key: `${Date.now()}-${i}`,
    ticket: t,
    status: "idle",
    error: null,
    attachedToInvoiceNo: null,
  }));
}

export default function BulkUploadForm({
  clientSuggestions,
  locationSuggestions,
  clientDefaultRates,
}: {
  clientSuggestions: string[];
  locationSuggestions: string[];
  clientDefaultRates: Record<string, number>;
}) {
  const router = useRouter();
  const supabaseBrowser = useMemo(() => createSupabaseBrowserClient(), []);

  const [fileInputKey, setFileInputKey] = useState(0);
  const [scanPath, setScanPath] = useState<string | null>(null);
  const [scanName, setScanName] = useState<string | null>(null);
  const [scanTooLarge, setScanTooLarge] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const savedCount = rows.filter((r) => r.status === "saved").length;
  const allSaved = rows.length > 0 && savedCount === rows.length;
  const savableCount = rows.filter((r) => r.status !== "saved").length;

  async function onScanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setScanTooLarge(false);
    setUploadError(null);
    setExtractError(null);
    setRows([]);
    setScanPath(null);
    setScanName(null);

    setCompressing(true);
    const file = await compressScanFile(rawFile);
    setCompressing(false);

    if (file.size > MAX_SCAN_BYTES) {
      setScanTooLarge(true);
      e.target.value = "";
      return;
    }

    setUploading(true);

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${crypto.randomUUID()}/${Date.now()}.${ext}`;
    const { error } = await supabaseBrowser.storage.from("ticket-scans").upload(path, file, {
      contentType: file.type || undefined,
    });
    if (error) {
      setUploadError(error.message);
      setUploading(false);
      e.target.value = "";
      return;
    }
    setScanPath(path);
    setScanName(file.name);
    setUploading(false);

    setExtracting(true);
    const result = await extractTicketsFromScan(supabaseBrowser, rawFile, path, clientSuggestions);
    setExtracting(false);
    if (result.error || !result.data) {
      setExtractError(result.error || "Extraction failed.");
      return;
    }
    setRows(emptyRows(result.data));
  }

  function patchRow(key: string, patch: Partial<ExtractedTicket>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ticket: { ...r.ticket, ...patch } } : r)));
  }

  function discardRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function startOver() {
    setScanPath(null);
    setScanName(null);
    setRows([]);
    setUploadError(null);
    setExtractError(null);
    setScanTooLarge(false);
    setFileInputKey((k) => k + 1);
  }

  async function handleSaveAll() {
    if (!scanPath) return;
    const toSave = rows.filter((r) => r.status !== "saved");
    if (!toSave.length) return;

    const valid = toSave.filter((r) => r.ticket.date && r.ticket.client);
    const invalidKeys = new Set(toSave.filter((r) => !r.ticket.date || !r.ticket.client).map((r) => r.key));

    setRows((prev) =>
      prev.map((r) => {
        if (invalidKeys.has(r.key)) return { ...r, status: "error", error: "Date and client are required." };
        if (valid.some((v) => v.key === r.key)) return { ...r, status: "saving", error: null };
        return r;
      })
    );

    if (!valid.length) return;

    setSaving(true);
    const inputs: CreateFromExtractionInput[] = valid.map((r) => ({
      ticketNo: r.ticket.ticketNo,
      date: r.ticket.date,
      client: r.ticket.client,
      locationProject: r.ticket.locationProject,
      truckNumber: r.ticket.truckNumber,
      timeIn: r.ticket.timeIn,
      timeOut: r.ticket.timeOut,
      travelTimeHours: r.ticket.travelTimeHours,
      totalHours: computeTotalHours(r.ticket.timeIn, r.ticket.timeOut, r.ticket.travelTimeHours)?.toString() ?? "",
      loads: r.ticket.loads,
      rate: r.ticket.rate,
      towRate: r.ticket.towRate,
      towCount: r.ticket.towCount,
      scanPath,
    }));

    const results = await createTicketsFromExtractions(inputs);
    setSaving(false);

    setRows((prev) => {
      const next = [...prev];
      results.forEach((result, i) => {
        const key = valid[i].key;
        const idx = next.findIndex((r) => r.key === key);
        if (idx === -1) return;
        next[idx] =
          "error" in result
            ? { ...next[idx], status: "error", error: result.error }
            : { ...next[idx], status: "saved", attachedToInvoiceNo: result.attachedToInvoiceNo, error: null };
      });
      return next;
    });

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3.5">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">Upload Scan</p>
        <p className="text-[12.5px] text-ink-2">
          A single photo or PDF containing a whole week&apos;s tickets — large files are compressed automatically.
          Every distinct ticket the AI finds gets pulled out below for a quick review, then saved all at once.
        </p>
        <input
          key={fileInputKey}
          type="file"
          accept="image/*,application/pdf"
          onChange={onScanChange}
          disabled={compressing || uploading || extracting}
          className="input"
        />
        {scanTooLarge && (
          <p className="text-sm font-semibold text-critical">
            That file is still over 20MB after compression — pick a smaller photo or PDF.
          </p>
        )}
        {compressing && <p className="text-sm font-semibold text-ink-2">Compressing scan…</p>}
        {uploading && <p className="text-sm font-semibold text-ink-2">Uploading…</p>}
        {uploadError && <p className="text-sm font-semibold text-critical">Upload failed: {uploadError}</p>}
        {scanName && !uploading && <p className="text-sm font-semibold text-good">{scanName} uploaded.</p>}
        {extracting && <p className="text-sm font-semibold text-ink-2">Reading the tickets…</p>}
        {extractError && <p className="text-sm font-semibold text-critical">AI extraction failed: {extractError}</p>}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted">
              {rows.length} Ticket{rows.length === 1 ? "" : "s"} Found — Review Before Saving
            </p>
            {!allSaved && (
              <button type="button" onClick={startOver} className="text-xs font-bold text-ink-2 hover:text-ink">
                Start Over
              </button>
            )}
          </div>

          {rows.map((row, i) => (
            <BulkTicketRow
              key={row.key}
              index={i + 1}
              data={row.ticket}
              onChange={(patch) => patchRow(row.key, patch)}
              onDiscard={() => discardRow(row.key)}
              status={row.status}
              error={row.error}
              attachedToInvoiceNo={row.attachedToInvoiceNo}
              clientSuggestions={clientSuggestions}
              locationSuggestions={locationSuggestions}
              clientDefaultRates={clientDefaultRates}
            />
          ))}

          {allSaved ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-good/10 border border-good/30 px-4 py-3">
              <p className="text-sm font-semibold text-good">
                All {savedCount} ticket{savedCount === 1 ? "" : "s"} created.
              </p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={startOver} className="text-sm font-bold text-ink-2 hover:text-ink">
                  Upload Another Scan
                </button>
                <Link href="/admin/invoices" className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-5 py-2.5">
                  Back to Tickets
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving || savableCount === 0}
                className="rounded-lg bg-accent text-accent-ink font-bold text-sm px-6 py-2.5 disabled:opacity-60"
              >
                {saving ? "Saving…" : `Save All (${savableCount})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
