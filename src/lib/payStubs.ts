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
  hourly_pay: number | null;
}

// Hours added to (+) or taken off (−) a driver's week that didn't come from a
// production sheet — e.g. yard work, or a correction.
export interface PayAdjustment {
  id: string;
  driver_key: string;
  driver_name: string;
  week_start: string;
  hours: number;
  rate: number | null;
  note: string | null;
}

export interface PayStubLine {
  // Set for a manual adjustment line (and null for a production-sheet shift).
  adjustmentId: string | null;
  note: string | null;
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
  // Calculated from the production sheets plus manual hour adjustments.
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

// An adjustment's rate: the one typed on it, else the driver's rate from
// that week's sheets, else their default rate on the roster.
function adjustmentRate(
  adj: PayAdjustment,
  weekSheets: PayStubSheet[],
  contact: RosterContact | null
): number | null {
  if (adj.rate !== null) return adj.rate;
  const fromSheet = [...weekSheets]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((x) => x.hourly_pay !== null)?.hourly_pay;
  return fromSheet ?? contact?.hourly_pay ?? null;
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

// Sheets often carry a suffix the roster omits ("… Nieves Sr" vs "… Nieves")
// — treat one key starting with the other as the same driver.
function resolveKey(key: string, known: Iterable<string>): string {
  for (const k of known) {
    if (k === key) return k;
  }
  for (const k of known) {
    if (k.length > 5 && key.length > 5 && (k.startsWith(key) || key.startsWith(k))) return k;
  }
  return key;
}

// `sheets` must cover Jan 1 of the week's ending year (or the week's start,
// if earlier) through the week's end, and `adjustments` every adjustment from
// then through this week, so the year-to-date totals come from the same lists.
export function buildPayStubs(
  sheets: PayStubSheet[],
  roster: RosterContact[],
  weekStart: string,
  checks: Record<string, string> = {},
  priors: Record<string, number> = {},
  adjustments: PayAdjustment[] = []
): PayStub[] {
  const weekEnd = addDaysISO(weekStart, 6);

  const byDriver = new Map<string, { name: string; sheets: PayStubSheet[]; adjustments: PayAdjustment[] }>();
  for (const s of sheets) {
    if (s.date > weekEnd) continue;
    const key = normalizeName(s.driver_name);
    const entry = byDriver.get(key) ?? { name: s.driver_name.trim(), sheets: [], adjustments: [] };
    entry.sheets.push(s);
    byDriver.set(key, entry);
  }
  for (const a of adjustments) {
    if (a.week_start > weekStart) continue;
    const key = resolveKey(a.driver_key, byDriver.keys());
    const entry = byDriver.get(key) ?? { name: a.driver_name.trim(), sheets: [], adjustments: [] };
    entry.adjustments.push(a);
    byDriver.set(key, entry);
  }

  const year = weekEnd.slice(0, 4);
  const stubs: PayStub[] = [];
  for (const [key, { name, sheets: driverSheets, adjustments: driverAdjs }] of byDriver.entries()) {
    const weekSheets = driverSheets.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    const weekAdjs = driverAdjs.filter((a) => a.week_start === weekStart);
    if (!weekSheets.length && !weekAdjs.length) continue;

    const contact = findContact(name, roster);

    const sheetLines: PayStubLine[] = weekSheets
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        adjustmentId: null,
        note: null,
        date: s.date,
        truck: s.truck_number,
        hours: s.hours ?? 0,
        rate: s.hourly_pay,
        amount: sheetAmount(s),
      }));
    const adjLines: PayStubLine[] = weekAdjs.map((a) => {
      const rate = adjustmentRate(a, weekSheets, contact);
      return {
        adjustmentId: a.id,
        note: a.note,
        date: weekEnd,
        truck: null,
        hours: a.hours,
        rate,
        amount: rate !== null ? round2(a.hours * rate) : null,
      };
    });
    const lines = [...sheetLines, ...adjLines];

    // Year-to-date: calendar year of the pay period's end (when it's paid).
    const ytdSheets = driverSheets.filter((s) => s.date.slice(0, 4) === year);
    const ytdAdjs = driverAdjs.filter((a) => addDaysISO(a.week_start, 6).slice(0, 4) === year);
    const ytdAdjAmounts = ytdAdjs.map((a) => {
      const wk = driverSheets.filter((s) => s.date >= a.week_start && s.date <= addDaysISO(a.week_start, 6));
      const rate = adjustmentRate(a, wk, contact);
      return rate !== null ? round2(a.hours * rate) : 0;
    });

    const ytdSheetsGross = round2(
      ytdSheets.reduce((acc, s) => acc + (sheetAmount(s) ?? 0), 0) + ytdAdjAmounts.reduce((acc, n) => acc + n, 0)
    );
    const priorPayments = priors[key] ?? 0;

    stubs.push({
      driverName: name,
      driverKey: key,
      checkNumber: checks[key] ?? "",
      phone: contact?.phone ?? null,
      weekStart,
      weekEnd,
      lines,
      totalHours: round2(lines.reduce((acc, l) => acc + l.hours, 0)),
      grossPay: round2(lines.reduce((acc, l) => acc + (l.amount ?? 0), 0)),
      missingRateCount: lines.filter((l) => l.hours !== 0 && l.amount === null).length,
      ytdHours: round2(
        ytdSheets.reduce((acc, s) => acc + (s.hours ?? 0), 0) + ytdAdjs.reduce((acc, a) => acc + a.hours, 0)
      ),
      ytdSheetsGross,
      priorPayments,
      ytdGross: round2(ytdSheetsGross + priorPayments),
    });
  }

  return stubs.sort((a, b) => a.driverName.localeCompare(b.driverName));
}
