import {
  REMIT_TO_NAME,
  REMIT_TO_ADDRESS_LINE1,
  REMIT_TO_CITY_STATE_ZIP,
  REMIT_TO_PHONE,
  INVOICE_SPECIAL_INSTRUCTIONS,
} from "@/lib/companyInfo";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

const SCAN_BUCKET = "ticket-scans";

function guessImageMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "image/jpeg";
}

// pdf-lib can only embed PNG/JPEG directly — route every non-PDF scan
// through the browser's own image decoder so gif/webp/heic scans work too,
// not just the two formats pdf-lib understands natively.
async function imageBytesToPngBytes(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0);
  const pngBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas conversion failed"))), "image/png")
  );
  return new Uint8Array(await pngBlob.arrayBuffer());
}

const PDF_INK = "#1a1a1a";
const PDF_MUTED = "#6b6b6b";
const PDF_BORDER = "#d8d7d0";
const PDF_MAROON = "#4b1a3d";
const PDF_STRIPE = "#f7f6f2";

function currency(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtDate(iso: string): string {
  const d = parseISO(iso);
  return d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : "";
}

// jsPDF's built-in fonts are WinAnsi-encoded and can't render a ★ glyph
// (it comes out as a mangled fallback character) — draw an actual small
// vector star instead of relying on the font to have one.
function drawStar(
  pdf: import("jspdf").jsPDF,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  color: string
) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = ((-90 + i * 36) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const deltas: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  pdf.setFillColor(color);
  pdf.lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
}

export interface InvoiceLineItem {
  date: string;
  ticketNo: string | null;
  truckNumber: string | null;
  hours: number;
  rate: number | null;
  towAmount: number | null;
  scanPath: string | null;
}

export interface InvoicePdfClient {
  name: string;
  company: string | null;
  address_line1: string | null;
  city_state_zip: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
}

export interface InvoicePdfInput {
  invoiceNo: string;
  date: string;
  client: InvoicePdfClient;
  customer: string;
  forDescription: string;
  terms: string;
  lines: InvoiceLineItem[];
}

export async function downloadInvoicePdf(input: InvoicePdfInput): Promise<void> {
  const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const pdf = new JsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // ---- Header ----
  pdf.setFont("times", "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(PDF_MAROON);
  {
    const headerY = y + 10;
    const starGap = 3;
    const starOuterR = 3.2;
    const starInnerR = 1.3;
    let hx = margin;
    ["A", "T", "G", "TRUCKING LLC"].forEach((part, i) => {
      pdf.text(part, hx, headerY);
      hx += pdf.getTextWidth(part);
      if (i < 3) {
        hx += starGap + starOuterR;
        drawStar(pdf, hx, headerY - 5.5, starOuterR, starInnerR, PDF_MAROON);
        hx += starOuterR + starGap;
      }
    });
  }

  pdf.setFont("times", "normal");
  pdf.setFontSize(30);
  pdf.setTextColor(PDF_MAROON);
  pdf.text("INVOICE", pageWidth - margin, y + 16, { align: "right" });

  y += 32;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(PDF_INK);
  [REMIT_TO_NAME, REMIT_TO_ADDRESS_LINE1, REMIT_TO_CITY_STATE_ZIP, `Phone: ${REMIT_TO_PHONE}`].forEach(
    (line) => {
      pdf.text(line, margin, y);
      y += 13;
    }
  );

  y += 14;

  // ---- Bill To / Invoice meta ----
  const colGap = 16;
  const leftColWidth = contentWidth * 0.52 - colGap / 2;
  const rightColWidth = contentWidth - leftColWidth - colGap;
  const rightColX = margin + leftColWidth + colGap;
  const barHeight = 16;

  function bar(x: number, barY: number, w: number, label: string) {
    pdf.setFillColor(PDF_MAROON);
    pdf.rect(x, barY, w, barHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor("#ffffff");
    pdf.text(label, x + 8, barY + barHeight - 5);
  }

  const sectionTop = y;

  // Bill To (left)
  bar(margin, y, leftColWidth, "BILL TO");
  y += barHeight + 10;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(PDF_INK);
  pdf.text(input.client.name, margin, y);
  y += 13;
  if (input.client.company) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.text(input.client.company, margin, y);
    y += 13;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(PDF_INK);
  const addressLines = [
    input.client.address_line1,
    input.client.city_state_zip,
    input.client.phone ? `Tel: ${input.client.phone}` : null,
    input.client.fax ? `Fax: ${input.client.fax}` : null,
    input.client.email ? `Email: ${input.client.email}` : null,
  ].filter((l): l is string => !!l);
  addressLines.forEach((line) => {
    pdf.text(line, margin, y);
    y += 13;
  });
  const leftColBottom = y;

  // Invoice meta (right) — INVOICE # / DATE, CUSTOMER, FOR, TERMS
  let ry = sectionTop;
  const halfRightWidth = rightColWidth / 2;
  bar(rightColX, ry, halfRightWidth, "INVOICE #");
  bar(rightColX + halfRightWidth, ry, halfRightWidth, "DATE");
  ry += barHeight + 11;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(PDF_INK);
  pdf.text(input.invoiceNo, rightColX + 4, ry);
  pdf.text(fmtDate(input.date), rightColX + halfRightWidth + 4, ry);
  ry += 12;

  const metaRows: [string, string][] = [
    ["CUSTOMER", input.customer],
    ["FOR", input.forDescription],
    ["TERMS", input.terms],
  ];
  metaRows.forEach(([label, value]) => {
    bar(rightColX, ry, rightColWidth, label);
    ry += barHeight + 11;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(PDF_INK);
    pdf.text(value || "—", rightColX + 4, ry);
    ry += 12;
  });

  y = Math.max(leftColBottom, ry) + 16;

  // ---- Line items table ----
  const total = input.lines.reduce(
    (sum, l) => sum + (l.rate !== null ? l.hours * l.rate : 0) + (l.towAmount ?? 0),
    0
  );

  // Skip the Tow column entirely when nothing on this invoice has a tow
  // reimbursement — a column of dashes isn't worth the width.
  const hasTow = input.lines.some((l) => l.towAmount !== null);
  const head = ["Date", "Ticket #", "Truck #", "Hours", "Rate", "Amount"];
  if (hasTow) head.push("Tow");

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [head],
    body: input.lines.map((l) => {
      const row = [
        fmtDate(l.date),
        l.ticketNo ?? "",
        l.truckNumber ?? "",
        l.hours.toLocaleString(),
        l.rate !== null ? currency(l.rate) : "—",
        l.rate !== null ? currency(l.hours * l.rate) : "—",
      ];
      if (hasTow) row.push(l.towAmount !== null ? currency(l.towAmount) : "—");
      return row;
    }),
    styles: { font: "helvetica", fontSize: 9, textColor: PDF_INK, cellPadding: 6, lineColor: PDF_BORDER },
    headStyles: { fillColor: PDF_MAROON, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: PDF_STRIPE },
    didDrawPage: () => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(PDF_MUTED);
    },
  });

  // ---- Total bar ----
  const afterTable = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const totalBarWidth = 220;
  const totalBarX = pageWidth - margin - totalBarWidth;
  let ty = afterTable + 4;
  pdf.setFillColor(PDF_MAROON);
  pdf.rect(totalBarX, ty, totalBarWidth, 26, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor("#ffffff");
  pdf.text("TOTAL", totalBarX + 10, ty + 18);
  pdf.text(currency(total), totalBarX + totalBarWidth - 10, ty + 18, { align: "right" });
  ty += 26 + 26;

  // ---- Special instructions & thank-you ----
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(PDF_INK);
  pdf.text("SPECIAL INSTRUCTIONS:", margin, ty);
  ty += 14;
  INVOICE_SPECIAL_INSTRUCTIONS.forEach((line) => {
    pdf.text(line, margin, ty);
    ty += 14;
  });

  ty += 20;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(10.5);
  pdf.setTextColor(PDF_INK);
  pdf.text("Thank you for your business!", pageWidth / 2, ty, { align: "center" });

  const fileName = `ATG-Trucking-Invoice-${input.invoiceNo}.pdf`;
  const scanPaths = input.lines.map((l) => l.scanPath).filter((p): p is string => !!p);
  if (!scanPaths.length) {
    pdf.save(fileName);
    return;
  }

  // Append each attached ticket scan as its own page (or pages, for a
  // multi-page PDF scan) after the invoice itself, so the sent document
  // carries the original paper tickets as backup.
  const pageHeight = pdf.internal.pageSize.getHeight();
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.load(pdf.output("arraybuffer"));
  const supabase = createSupabaseBrowserClient();

  for (const path of scanPaths) {
    try {
      const { data, error } = await supabase.storage.from(SCAN_BUCKET).download(path);
      if (error || !data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());

      if (/\.pdf$/i.test(path)) {
        const scanDoc = await PDFDocument.load(bytes);
        const copiedPages = await merged.copyPages(scanDoc, scanDoc.getPageIndices());
        copiedPages.forEach((p) => merged.addPage(p));
      } else {
        const pngBytes = await imageBytesToPngBytes(bytes, guessImageMime(path));
        const png = await merged.embedPng(pngBytes);
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;
        const scale = Math.min(maxW / png.width, maxH / png.height, 1);
        const w = png.width * scale;
        const h = png.height * scale;
        const page = merged.addPage([pageWidth, pageHeight]);
        page.drawImage(png, { x: (pageWidth - w) / 2, y: (pageHeight - h) / 2, width: w, height: h });
      }
    } catch {
      // Best effort — a scan that fails to merge (unreadable format,
      // network hiccup) just gets skipped rather than blocking the whole
      // invoice download.
      continue;
    }
  }

  const mergedBytes = await merged.save();
  const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
