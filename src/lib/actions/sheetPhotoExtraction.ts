"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";
import { DUMPING_LOCATIONS, MATERIAL_TYPES, COMPANIES, TRUCK_NUMBERS } from "@/lib/loadOptions";

const SHEET_PHOTOS_BUCKET = "sheet-photos";
type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface ExtractedLoad {
  jobSite: string;
  dumping: string;
  type: string;
  company: string;
  jobSiteArrivalTime: string;
  jobSiteDepartureTime: string;
  note: string;
}

export interface ExtractedSheet {
  driverName: string;
  date: string;
  truckNumber: string;
  startTime: string;
  endTime: string;
  hours: string;
  fuelGallons: string;
  startMiles: string;
  endMiles: string;
  remarks: string;
  loads: ExtractedLoad[];
}

interface ExtractResult {
  data?: ExtractedSheet;
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

function normalize(raw: unknown): ExtractedSheet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rawLoads = Array.isArray(r.loads) ? r.loads : [];
  return {
    driverName: str(r.driverName),
    date: str(r.date),
    truckNumber: str(r.truckNumber),
    startTime: str(r.startTime),
    endTime: str(r.endTime),
    hours: str(r.hours),
    fuelGallons: str(r.fuelGallons),
    startMiles: str(r.startMiles),
    endMiles: str(r.endMiles),
    remarks: str(r.remarks),
    loads: rawLoads.map((l) => {
      const load = (l ?? {}) as Record<string, unknown>;
      return {
        jobSite: str(load.jobSite),
        dumping: str(load.dumping),
        type: str(load.type),
        company: str(load.company),
        jobSiteArrivalTime: str(load.jobSiteArrivalTime),
        jobSiteDepartureTime: str(load.jobSiteDepartureTime),
        note: str(load.note),
      };
    }),
  };
}

// Photos and PDF scans are uploaded straight from the browser to Supabase
// Storage (same reasoning as ticket scans: Vercel's serverless functions
// cap request bodies well under a phone photo or scanned PDF). This action
// only ever receives the resulting storage paths, downloads the bytes
// itself to hand to Claude, and deletes the objects afterward — they're
// only used as OCR input, not kept as a record.
export async function extractSheetFromPhotos(paths: string[]): Promise<ExtractResult> {
  await requireAdmin();

  const cleanPaths = paths.filter(Boolean);
  if (!cleanPaths.length) return { error: "No files to extract from." };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "AI extraction isn't configured — missing ANTHROPIC_API_KEY." };

  const supabase = await createClient();

  try {
    const fileBlocks: (Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam)[] = [];
    for (const path of cleanPaths) {
      const { data, error } = await supabase.storage.from(SHEET_PHOTOS_BUCKET).download(path);
      if (error || !data)
        return { error: `Couldn't load an uploaded file: ${error?.message ?? "unknown error"}` };
      const bytes = Buffer.from(await data.arrayBuffer());
      if (isPdfPath(path)) {
        fileBlocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: bytes.toString("base64"),
          },
        });
      } else {
        fileBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaTypeFromPath(path),
            data: bytes.toString("base64"),
          },
        });
      }
    }

    const todayYear = new Date().getFullYear();
    const prompt = `You are extracting data from one or more photos or scanned PDF pages of a handwritten trucking production sheet for ATG Trucking LLC. If multiple files were provided, they are pages of the same sheet — merge them into one result. Read carefully and return ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:

{
  "driverName": string,
  "date": string,          // YYYY-MM-DD; if the year is missing or ambiguous, assume ${todayYear}
  "truckNumber": string,
  "startTime": string,     // 24h "HH:MM", "" if not legible/present
  "endTime": string,       // 24h "HH:MM", "" if not legible/present
  "hours": string,         // decimal hours as text, "" if not present
  "fuelGallons": string,   // "" if not present
  "startMiles": string,    // "" if not present
  "endMiles": string,      // "" if not present
  "remarks": string,       // notes, breakdowns, delays written on the sheet
  "loads": [
    {
      "jobSite": string,
      "dumping": string,
      "type": string,               // material type
      "company": string,
      "jobSiteArrivalTime": string,   // 24h "HH:MM"
      "jobSiteDepartureTime": string, // 24h "HH:MM"
      "note": string
    }
  ]
}

Known truck numbers for this fleet (match to these if handwriting is close, otherwise transcribe as written): ${TRUCK_NUMBERS.join(", ")}
Known dumping locations: ${DUMPING_LOCATIONS.join(", ")}
Known material types: ${MATERIAL_TYPES.join(", ")}
Known companies: ${COMPANIES.join(", ")}

Leave a field as "" if it isn't legible or isn't on the sheet — never guess or fabricate a value. Return one "loads" entry per load/trip row on the sheet, in the order they appear.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [...fileBlocks, { type: "text", text: prompt }],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: "The AI didn't return any text." };

    let parsed: unknown;
    try {
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : textBlock.text);
    } catch {
      return { error: "Couldn't parse the AI's response as JSON." };
    }

    const normalized = normalize(parsed);
    if (!normalized) return { error: "The AI's response didn't match the expected shape." };

    return { data: normalized };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: "Invalid Anthropic API key." };
    if (err instanceof Anthropic.RateLimitError) return { error: "AI extraction is rate-limited — try again shortly." };
    if (err instanceof Anthropic.APIError) return { error: `AI extraction failed: ${err.message}` };
    return { error: err instanceof Error ? err.message : "AI extraction failed." };
  } finally {
    await supabase.storage.from(SHEET_PHOTOS_BUCKET).remove(cleanPaths);
  }
}
