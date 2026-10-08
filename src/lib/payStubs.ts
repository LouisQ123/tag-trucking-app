import { addDaysISO } from "@/lib/workWeek";

export interface PayStubSheet {
  driver_name: string;
  date: string;
  truck_number: string | null;
  hours: number | null;
  hourly_pay: number | null;
  labor_cost: number | null;
}

export interface RosterContact {
  full_name: string;
  phone: string | null;
}

export interface PayStubLine {
  date: string;
  truck: string | null;
  hours: number;
  rate: number | null;
  amount: number | null;
}

export interface PayStub {
  driverName: string;
  driverKey: string;
  checkNumber: string;
  phone: string | null;
  weekStart: string;
  weekEnd: string;
  lines: PayStubLine[];
  totalHours: number;
  grossPay: number;
  // Sheets with hours but no pay rate can't be priced — they're listed on
  // the stub with a dash and left out of the gross, so the admin can see
  // exactly what's unpaid-for rather than a silently wrong total.
  missingRateCount: number;
  ytdHours: number;
  // Calculated from the production sheets only.
  ytdSheetsGross: number;
  // Paid earlier in the year, before the app tracked it (entered by hand).
  priorPayments: number;
  // ytdSheetsGross + priorPayments.
  ytdGross: number;
}

// Stable identity for a driver across sheets (and for saved check numbers).
export function driverKey(name: string): string {
  return normalizeName(name);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Same figure the dashboard's payroll uses (the labor_cost snapshot taken
// when the sheet was saved), falling back to hours × rate for a sheet that
// never got one.
function sheetAmount(s: PayStubSheet): number | null {
  if (s.labor_cost !== null) return s.labor_cost;
  if (s.hours !== null && s.hourly_pay !== null) return round2(s.hours * s.hourly_pay);
  return null;
}

function findContact(name: string, roster: RosterContact[]): RosterContact | null {
  const n = normalizeName(name);
  const exact = roster.find((r) => normalizeName(r.full_name) === n);
  if (exact) return exact;
  // Sheets often carry a suffix the roster omits ("… Nieves Sr" vs
  // "… Nieves") — fall back to one name containing the other.
  return (
    roster.find((r) => {
      const rn = normalizeName(r.full_name);
      return rn.length > 5 && (n.startsWith(rn) || rn.startsWith(n));
    }) ?? null
  );
}

// `sheets` must cover Jan 1 of the week's ending year (or the week's start,
// if earlier) through the week's end, so the year-to-date totals can be
// computed from the same list.
export function buildPayStubs(
  sheets: PayStubSheet[],
  roster: RosterContact[],
  weekStart: string,
  checks: Record<string, string> = {},
  priors: Record<string, number> = {}
): PayStub[] {
  const weekEnd = addDaysISO(weekStart, 6);

  const byDriver = new Map<string, { name: string; sheets: PayStubSheet[] }>();
  for (const s of sheets) {
    if (s.date > weekEnd) continue;
    const key = normalizeName(s.driver_name);
    const entry = byDriver.get(key) ?? { name: s.driver_name.trim(), sheets: [] };
    entry.sheets.push(s);
    byDriver.set(key, entry);
  }

  const stubs: PayStub[] = [];
  for (const [key, { name, sheets: driverSheets }] of byDriver.entries()) {
    const weekSheets = driverSheets.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    if (!weekSheets.length) continue;

    const lines: PayStubLine[] = weekSheets
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        date: s.date,
        truck: s.truck_number,
        hours: s.hours ?? 0,
        rate: s.hourly_pay,
        amount: sheetAmount(s),
      }));

    // Calendar year of the pay period's end, since that's when it's paid.
    const ytdSheets = driverSheets.filter((s) => s.date.slice(0, 4) === weekEnd.slice(0, 4));

    const ytdSheetsGross = round2(ytdSheets.reduce((a, s) => a + (sheetAmount(s) ?? 0), 0));
    const priorPayments = priors[key] ?? 0;

    stubs.push({
      driverName: name,
      driverKey: key,
      checkNumber: checks[key] ?? "",
      phone: findContact(name, roster)?.phone ?? null,
      weekStart,
      weekEnd,
      lines,
      totalHours: round2(lines.reduce((a, l) => a + l.hours, 0)),
      grossPay: round2(lines.reduce((a, l) => a + (l.amount ?? 0), 0)),
      missingRateCount: lines.filter((l) => l.hours > 0 && l.amount === null).length,
      ytdHours: round2(ytdSheets.reduce((a, s) => a + (s.hours ?? 0), 0)),
      ytdSheetsGross,
      priorPayments,
      ytdGross: round2(ytdSheetsGross + priorPayments),
    });
  }

  return stubs.sort((a, b) => a.driverName.localeCompare(b.driverName));
}
