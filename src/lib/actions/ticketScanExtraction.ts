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

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
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

// The scan is already uploaded straight from the browser to Supabase
// Storage by the time this runs (same body-size reasoning as sheet
// photos) — this action just downloads those same bytes to hand to
// Claude. Unlike sheet photos, the scan is NOT deleted afterward: it's
// the permanent attachment already destined to be saved on the ticket.
export async function extractTicketFromScan(path: string, knownClients: string[] = []): Promise<ExtractResult> {
  await requireAdmin();

  if (!path) return { error: "No scan to extract from." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI extraction isn't configured — missing ANTHROPIC_API_KEY." };

  const supabase = await createClient();

  try {
    const { data, error } = await supabase.storage.from(SCAN_BUCKET).download(path);
    if (error || !data) return { error: `Couldn't load the uploaded scan: ${error?.message ?? "unknown error"}` };
    const bytes = Buffer.from(await data.arrayBuffer());

    const fileBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam = isPdfPath(path)
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mediaTypeFromPath(path), data: bytes.toString("base64") },
        };

    const todayYear = new Date().getFullYear();
    const prompt = `You are extracting data from a photo or scanned PDF of one or more physical trucking job tickets for ATG Trucking LLC. A single scan can show more than one distinct ticket (e.g. two tickets photographed side by side, or a multi-page PDF where each page is a different ticket) — read carefully and return ONLY a JSON array (no markdown fences, no commentary), with one object per distinct ticket found, in the order they appear. If only one ticket is present, return an array with exactly one object. Each object has exactly this shape:

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
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [fileBlock, { type: "text", text: prompt }],
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
  }
}
