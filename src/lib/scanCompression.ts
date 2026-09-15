// Client-side only — shrinks a ticket scan before it's uploaded, so a
// merged multi-page PDF or a full-resolution phone photo doesn't blow past
// the 20MB storage limit. Runs entirely in the browser (no server
// round-trip, consistent with why scans upload straight to Storage in the
// first place) using pdfjs-dist to rasterize PDF pages and pdf-lib to
// rebuild a lighter PDF from the re-compressed pages.
//
// The pdfjs worker script at public/pdf.worker.min.mjs is a static copy of
// node_modules/pdfjs-dist/build/pdf.worker.min.mjs — if pdfjs-dist is ever
// upgraded, re-copy that file (its API version must match this package's).
import { PDFDocument } from "pdf-lib";

// Storage-target resolution — compact enough to keep a multi-page scan well
// under the upload cap while still being fine for a human to view later.
const MAX_DIM = 1800;
// A PDF sent to Claude as a "document" block gets downsampled far more
// aggressively server-side than the same content sent as standalone
// images — confirmed by testing identical ticket content both ways: the
// document path silently dropped handwritten ticket #/client/truck fields
// that the image path read correctly. So PDF pages headed for extraction
// are rendered at a notably higher resolution than the storage copy.
const EXTRACTION_MAX_DIM = 3000;
const JPEG_QUALITY = 0.8;
// Below this, a scan is already small enough that compressing it further
// isn't worth the quality loss.
const COMPRESS_THRESHOLD_BYTES = 6 * 1024 * 1024;

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas produced no image data."))),
      "image/jpeg",
      quality
    );
  });
}

interface RenderedPage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

// Core PDF rasterization, parameterized by target resolution so the same
// logic serves both the compact storage copy and the higher-fidelity
// extraction images without duplicating the pdfjs setup/render loop.
async function renderPdfPages(file: File, maxDim: number, quality: number): Promise<RenderedPage[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourceDoc = await pdfjsLib.getDocument({ data: sourceBytes }).promise;
  const pages: RenderedPage[] = [];

  for (let pageNum = 1; pageNum <= sourceDoc.numPages; pageNum++) {
    const page = await sourceDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = maxDim / Math.max(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported.");
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const blob = await canvasToJpegBlob(canvas, quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    pages.push({ bytes, width: canvas.width, height: canvas.height });
  }

  return pages;
}

async function compressImageFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_DIM / Math.max(bitmap.width, bitmap.height), 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const jpegBlob = await canvasToJpegBlob(canvas, JPEG_QUALITY);
  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([jpegBlob], newName, { type: "image/jpeg" });
}

async function compressPdfFile(file: File): Promise<File> {
  const pages = await renderPdfPages(file, MAX_DIM, JPEG_QUALITY);
  const outDoc = await PDFDocument.create();

  for (const p of pages) {
    const jpegImage = await outDoc.embedJpg(p.bytes);
    const outPage = outDoc.addPage([p.width, p.height]);
    outPage.drawImage(jpegImage, { x: 0, y: 0, width: p.width, height: p.height });
  }

  const outBytes = await outDoc.save();
  return new File([new Uint8Array(outBytes)], file.name, { type: "application/pdf" });
}

// Best-effort: any failure (unsupported format, a browser without canvas
// support, a corrupt file) just falls back to the original file rather than
// blocking the upload — the existing size check downstream still catches a
// scan that's genuinely too large.
export async function compressScanFile(file: File): Promise<File> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;

  try {
    const compressed = isPdfFile(file) ? await compressPdfFile(file) : await compressImageFile(file);
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}

// Renders a PDF's pages at extraction-appropriate resolution for the AI
// reader — deliberately separate from (and higher-resolution than)
// compressScanFile's storage copy; see EXTRACTION_MAX_DIM above for why.
// Only PDFs need this: a single photo already extracts fine from its own
// uploaded path with no extra rendering.
export async function buildPdfExtractionPages(file: File): Promise<Uint8Array[]> {
  const pages = await renderPdfPages(file, EXTRACTION_MAX_DIM, JPEG_QUALITY);
  return pages.map((p) => p.bytes);
}
