import { REMIT_TO_NAME, REMIT_TO_ADDRESS_LINE1, REMIT_TO_CITY_STATE_ZIP, REMIT_TO_PHONE } from "@/lib/companyInfo";
import type { PayStub } from "@/lib/payStubs";
import { drawCompanyHeader } from "@/lib/invoicePdf";

const PDF_INK = "#1a1a1a";
const PDF_MUTED = "#6b6b6b";
const PDF_BORDER = "#d8d7d0";
const PDF_MAROON = "#4b1a3d";
const PDF_STRIPE = "#f7f6f2";

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function payStubFileName(stubs: PayStub[]): string {
  const week = stubs[0]?.weekStart ?? "week";
  if (stubs.length === 1) {
    const name = stubs[0].driverName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `ATG-PayStub-${name}-${week}.pdf`;
  }
  return `ATG-PayStubs-All-Drivers-${week}.pdf`;
}

// One page (more only if a driver has a very long week) per stub, all in one
// PDF — a single stub downloads as that driver's own file, several as one
// combined file for the whole week.
export async function downloadPayStubsPdf(stubs: PayStub[]): Promise<void> {
  if (!stubs.length) return;
  const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const pdf = new JsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const statementDate = todayLabel();

  stubs.forEach((stub, index) => {
    if (index > 0) pdf.addPage();
    let y = margin;

    // ---- Header ----
    drawCompanyHeader(pdf, margin, y);

    pdf.setFont("times", "normal");
    pdf.setFontSize(20);
    pdf.text("PAY STATEMENT", pageWidth - margin, y + 12, { align: "right" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(PDF_MUTED);
    pdf.text("INDEPENDENT CONTRACTOR (1099)", pageWidth - margin, y + 25, { align: "right" });

    y += 32;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(PDF_INK);
    [REMIT_TO_NAME, REMIT_TO_ADDRESS_LINE1, REMIT_TO_CITY_STATE_ZIP, `Phone: ${REMIT_TO_PHONE}`].forEach((line) => {
      pdf.text(line, margin, y);
      y += 13;
    });
    y += 14;

    // ---- Contractor / pay period ----
    const colGap = 16;
    const leftW = contentWidth * 0.52 - colGap / 2;
    const rightW = contentWidth - leftW - colGap;
    const rightX = margin + leftW + colGap;
    const barH = 16;

    function bar(x: number, barY: number, w: number, label: string) {
      pdf.setFillColor(PDF_MAROON);
      pdf.rect(x, barY, w, barH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor("#ffffff");
      pdf.text(label, x + 8, barY + barH - 5);
    }

    const top = y;
    bar(margin, y, leftW, "PAID TO (CONTRACTOR)");
    let ly = y + barH + 12;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(PDF_INK);
    pdf.text(stub.driverName, margin, ly);
    ly += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    if (stub.phone) {
      pdf.text(`Phone: ${stub.phone}`, margin, ly);
      ly += 13;
    }

    const half = rightW / 2;
    bar(rightX, top, half, "PAY PERIOD");
    bar(rightX + half, top, half, "STATEMENT DATE");
    let ry = top + barH + 12;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(PDF_INK);
    pdf.text(`${fmtDate(stub.weekStart)} – ${fmtDate(stub.weekEnd)}`, rightX + 4, ry);
    pdf.text(statementDate, rightX + half + 4, ry);
    ry += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(PDF_MUTED);
    pdf.setFontSize(8.5);
    pdf.text("Monday – Sunday work week", rightX + 4, ry);
    ry += 14;
    if (stub.checkNumber) {
      bar(rightX, ry, rightW, "CHECK #");
      ry += barH + 12;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(PDF_INK);
      pdf.text(stub.checkNumber, rightX + 4, ry);
      ry += 12;
    }

    y = Math.max(ly, ry) + 14;

    // ---- Daily breakdown ----
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Truck #", "Hours", "Rate", "Amount"]],
      body: stub.lines.map((l) => [
        fmtDate(l.date),
        l.truck ?? "—",
        l.hours.toLocaleString("en-US"),
        l.rate !== null ? currency(l.rate) : "—",
        l.amount !== null ? currency(l.amount) : "—",
      ]),
      foot: [["Week total", "", stub.totalHours.toLocaleString("en-US"), "", currency(stub.grossPay)]],
      showFoot: "lastPage",
      styles: { font: "helvetica", fontSize: 9, textColor: PDF_INK, cellPadding: 6, lineColor: PDF_BORDER },
      headStyles: { fillColor: PDF_MAROON, textColor: "#ffffff", fontStyle: "bold" },
      footStyles: { fillColor: "#ece9e1", textColor: PDF_INK, fontStyle: "bold" },
      alternateRowStyles: { fillColor: PDF_STRIPE },
    });

    let ty = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    if (stub.missingRateCount > 0) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(8.5);
      pdf.setTextColor(PDF_MUTED);
      pdf.text(
        `${stub.missingRateCount} shift${stub.missingRateCount === 1 ? "" : "s"} had no pay rate recorded and ${
          stub.missingRateCount === 1 ? "is" : "are"
        } not included in the amount above.`,
        margin,
        ty + 6
      );
      ty += 18;
    }

    // ---- Summary ----
    ty += 14;
    const boxW = 250;
    const valueOffset = 150;
    const boxX = pageWidth - margin - boxW;
    const rows: [string, string][] = [
      ["Gross pay this period", currency(stub.grossPay)],
      ["Taxes withheld", currency(0)],
      ["Net pay this period", currency(stub.grossPay)],
    ];
    pdf.setFillColor(PDF_MAROON);
    pdf.rect(boxX, ty, boxW, barH, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor("#ffffff");
    pdf.text("THIS PERIOD", boxX + 8, ty + barH - 5);
    ty += barH + 14;
    rows.forEach(([label, value], i) => {
      const last = i === rows.length - 1;
      pdf.setFont("helvetica", last ? "bold" : "normal");
      pdf.setFontSize(last ? 11 : 9.5);
      pdf.setTextColor(PDF_INK);
      pdf.text(label, boxX + 8, ty);
      pdf.text(value, boxX + valueOffset, ty);
      ty += last ? 0 : 15;
    });
    ty += 24;

    pdf.setFillColor(PDF_MAROON);
    pdf.rect(boxX, ty, boxW, barH, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor("#ffffff");
    pdf.text(`YEAR TO DATE (${stub.weekEnd.slice(0, 4)})`, boxX + 8, ty + barH - 5);
    ty += barH + 14;
    const ytdRows: [string, string][] = [["Hours", stub.ytdHours.toLocaleString("en-US")]];
    if (stub.priorPayments !== 0) {
      ytdRows.push(["Paid earlier this year", currency(stub.priorPayments)]);
      ytdRows.push(["Paid via this app", currency(stub.ytdSheetsGross)]);
    }
    ytdRows.push(["Total gross paid", currency(stub.ytdGross)]);
    ytdRows.forEach(([label, value]) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(PDF_INK);
      pdf.text(label, boxX + 8, ty);
      pdf.text(value, boxX + valueOffset, ty);
      ty += 15;
    });

    // ---- Footer note ----
    const noteY = Math.max(ty + 24, 700);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(PDF_MUTED);
    const note = pdf.splitTextToSize(
      "Paid as an independent contractor. No federal, state, or FICA taxes have been withheld; the contractor is responsible for reporting this income and paying any self-employment and income taxes due. A Form 1099-NEC will be issued where required by IRS rules.",
      contentWidth
    );
    pdf.text(note, margin, noteY);
  });

  pdf.save(payStubFileName(stubs));
}
