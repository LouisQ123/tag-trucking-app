"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import { TRUCK_NUMBERS } from "@/lib/loadOptions";

const SCAN_BUCKET = "ticket-scans";
type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface ExtractedTicket {
  ticketNo: string;
  date: string;
  client: string;
  locationProject: string;
  truckNumber: string;
  timeIn: string;
  timeOut: string;
  travelTimeHours: string;
  loads: string;
  rate: string;
  towRate: string;
  towCount: string;
}

interface ExtractResult {
  data?: ExtractedTicket[];
  error?: string;
}

function mediaTypeFromPath(path: string): SupportedMediaType {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalize(raw: unknown): ExtractedTicket | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    ticketNo: str(r.ticketNo),
    date: str(r.date),
    client: str(r.client),
    locationProject: str(r.locationProject),
    truckNumber: str(r.truckNumber),
    timeIn: str(r.timeIn),
    timeOut: str(r.timeOut),
    travelTimeHours: str(r.travelTimeHours),
    loads: str(r.loads),
    rate: str(r.rate),
    towRate: str(r.towRate),
    towCount: str(r.towCount),
  };
}

// Every path is downloaded and sent to Claude as a standalone image — never
// as a PDF "document" block. Testing identical ticket content both ways
// showed the document path gets downsampled far more aggressively
// server-side, silently dropping small handwritten fields (ticket #,
// client, truck #) that the same content reads correctly as an image. So a
// multi-page PDF is rasterized into per-page images client-side first (see
// scanCompression.ts) and each page is passed here as its own path.
//
// `cleanupAfter` deletes every path once the call finishes (success or
// failure) — for the temporary per-page renders of a PDF upload, which
// exist only to feed this call. It must stay false for a single photo's
// own permanent scan_path, which is the ticket's saved attachment.
export async function extractTicketsFromScanPages(
  paths: string[],
  knownClients: string[] = [],
  options: { cleanupAfter?: boolean } = {}
): Promise<ExtractResult> {
  await requireAdmin();

  if (!paths.length) return { error: "No scan to extract from." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI extraction isn't configured — missing ANTHROPIC_API_KEY." };

  const supabase = await createClient();

  try {
    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    for (const path of paths) {
      const { data, error } = await supabase.storage.from(SCAN_BUCKET).download(path);
      if (error || !data) return { error: `Couldn't load the uploaded scan: ${error?.message ?? "unknown error"}` };
      const bytes = Buffer.from(await data.arrayBuffer());
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaTypeFromPath(path), data: bytes.toString("base64") },
      });
    }

    const todayYear = new Date().getFullYear();
    const prompt = `You are extracting data from one or more photos of physical trucking job tickets for ATG Trucking LLC. Each image is one page — a single page can itself show more than one distinct ticket (e.g. two tickets side by side on a carbonless duplicate pad), and there can be anywhere from one page up to a full week's worth (5-10+) of pages. Read every image carefully and return ONLY a JSON array (no markdown fences, no commentary), with one object per distinct ticket found, in the order they appear across the images. Never skip or merge tickets to save space — include every one you can find. If only one ticket is present, return an array with exactly one object. Each object has exactly this shape:

{
  "ticketNo": string,       // ticket/job number written on the ticket, "" if not present
  "date": string,           // YYYY-MM-DD; if the year is missing or ambiguous, assume ${todayYear}
  "client": string,         // the client/company being billed for this job
  "locationProject": string, // job site or project name/address
  "truckNumber": string,
  "timeIn": string,         // 24h "HH:MM", "" if not legible/present
  "timeOut": string,        // 24h "HH:MM", "" if not legible/present
  "travelTimeHours": string, // decimal hours as text, "" if not present
  "loads": string,          // number of loads as text, "" if not present
  "rate": string,           // hourly billing rate in dollars as text, "" if not present
  "towRate": string,        // per-tow rate in dollars as text, "" if not present
  "towCount": string        // number of tows as text, "" if not present
}

${
  knownClients.length
    ? `Known clients billed by this company (match "client" to the closest one if handwriting is close, otherwise transcribe as written): ${knownClients.join(", ")}\n`
    : ""
}Known truck numbers for this fleet (match to these if handwriting is close, otherwise transcribe as written): ${TRUCK_NUMBERS.join(", ")}

Leave a field as "" if it isn't legible or isn't on a ticket — never guess or fabricate a value.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-5",
      // A single scan can hold a full week's worth of tickets (5-10+), so
      // this needs enough headroom for that many JSON objects, not just one.
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "The AI didn't return any text." };

    let parsed: unknown;
    try {
      const match = textBlock.text.match(/\[[\s\S]*\]/);
      parsed = JSON.parse(match ? match[0] : textBlock.text);
    } catch {
      return { error: "Couldn't parse the AI's response as JSON." };
    }

    const rawList = Array.isArray(parsed) ? parsed : [parsed];
    const normalized = rawList.map(normalize).filter((t): t is ExtractedTicket => t !== null);
    if (!normalized.length) return { error: "The AI's response didn't match the expected shape." };

    return { data: normalized };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: "Invalid Anthropic API key." };
    if (err instanceof Anthropic.RateLimitError) return { error: "AI extraction is rate-limited — try again shortly." };
    if (err instanceof Anthropic.APIError) return { error: `AI extraction failed: ${err.message}` };
    return { error: err instanceof Error ? err.message : "AI extraction failed." };
  } finally {
    if (options.cleanupAfter) {
      await supabase.storage.from(SCAN_BUCKET).remove(paths);
    }
  }
}
