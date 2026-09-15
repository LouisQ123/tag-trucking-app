import { isPdfFile, buildPdfExtractionPages } from "@/lib/scanCompression";
import { extractTicketsFromScanPages, type ExtractedTicket } from "@/lib/actions/ticketScanExtraction";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

// A single photo already extracts fine straight from its own permanent
// scan_path — no extra work needed. A PDF needs its pages rendered at
// extraction resolution and uploaded to temporary paths first (see
// scanCompression.ts for why the stored PDF itself can't be used directly);
// those temp paths are cleaned up server-side once the AI call finishes.
export async function extractTicketsFromScan(
  supabaseBrowser: SupabaseBrowserClient,
  rawFile: File,
  scanPath: string,
  knownClients: string[]
): Promise<{ data?: ExtractedTicket[]; error?: string }> {
  if (!isPdfFile(rawFile)) {
    return extractTicketsFromScanPages([scanPath], knownClients);
  }

  const pages = await buildPdfExtractionPages(rawFile);
  const tempPaths = await Promise.all(
    pages.map(async (bytes, i) => {
      const path = `${crypto.randomUUID()}/extract-${i}.jpg`;
      const { error } = await supabaseBrowser.storage
        .from("ticket-scans")
        .upload(path, new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      return path;
    })
  );

  return extractTicketsFromScanPages(tempPaths, knownClients, { cleanupAfter: true });
}
