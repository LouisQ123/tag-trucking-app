// Work weeks are anchored to Eastern time (the company's timezone) rather
// than server-local time, since Vercel's serverless functions run in UTC —
// using server-local time would flip "today" a few hours early/late relative
// to what the office actually experiences as Monday/Sunday.
const TIME_ZONE = "America/New_York";
const DAY_MS = 24 * 60 * 60 * 1000;

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function toEasternYmd(date: Date): Ymd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { y: Number(map.year), m: Number(map.month), d: Number(map.day) };
}

// Treated purely as a calendar-day ordinal (not a real instant) so we can
// diff/add whole days without DST shifting the result.
function ymdToOrdinal({ y, m, d }: Ymd): number {
  return Date.UTC(y, m - 1, d);
}

// `date` is a plain "YYYY-MM-DD" column with no time/timezone component, so
// it's parsed directly as a calendar day rather than through Eastern-time
// conversion (which would risk shifting it a day off).
function parseIsoDate(dateStr: string): Ymd | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

// The due date is the Monday following the Mon–Sun work week the invoice's
// own date falls in — computed per invoice (not from "today") so that on
// the due date itself, last week's invoices are still correctly due today
// rather than already having rolled into a new "current" week.
function dueDateOrdinal(invoiceDate: string): number | null {
  const ymd = parseIsoDate(invoiceDate);
  if (!ymd) return null;
  const ordinal = ymdToOrdinal(ymd);
  const weekday = new Date(ordinal).getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const weekStartOrdinal = ordinal + diffToMonday * DAY_MS;
  return weekStartOrdinal + 7 * DAY_MS;
}

// Stays true through 11:59:59pm Eastern on the due Monday, then flips false
// once the Eastern calendar date rolls past it.
export function isBadgeActive(invoiceDate: string): boolean {
  const due = dueDateOrdinal(invoiceDate);
  if (due === null) return false;
  const todayOrdinal = ymdToOrdinal(toEasternYmd(new Date()));
  return todayOrdinal <= due;
}

export function formatSubmitBy(invoiceDate: string): string {
  const due = dueDateOrdinal(invoiceDate);
  if (due === null) return "";
  return new Date(due).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

// Today's calendar date in Eastern time as "YYYY-MM-DD" — for anything that
// needs "today" as a plain date column value (e.g. a server-generated
// invoice's date) computed the same Eastern-anchored way as the rest of
// this file, rather than the server's own (UTC, on Vercel) local date.
export function todayEasternISO(): string {
  const { y, m, d } = toEasternYmd(new Date());
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ordinalToISO(ordinal: number): string {
  const d = new Date(ordinal);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// The current Mon–Sun work week's boundaries (Eastern time, based on
// today), as "YYYY-MM-DD" strings — for filtering which tickets/records
// belong to "this week" (e.g. the Friday auto-invoice job).
export function currentWorkWeekRange(): { startISO: string; endISO: string } {
  const todayOrdinal = ymdToOrdinal(toEasternYmd(new Date()));
  const weekday = new Date(todayOrdinal).getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const weekStartOrdinal = todayOrdinal + diffToMonday * DAY_MS;
  const weekEndOrdinal = weekStartOrdinal + 6 * DAY_MS;
  return { startISO: ordinalToISO(weekStartOrdinal), endISO: ordinalToISO(weekEndOrdinal) };
}

// "terms" is free text like "Net 30 days" (editable per invoice) — pull out
// the first number as the payment window, falling back to 30 if it can't be
// parsed (e.g. "Due on receipt").
function parseTermsDays(terms: string): number {
  const match = terms.match(/\d+/);
  if (!match) return 30;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

// An invoice is overdue once its payment terms have lapsed and it's still
// unpaid — a draft hasn't been sent yet, and a paid invoice is resolved, so
// only "pending" invoices are ever overdue.
export function isInvoiceOverdue(invoiceDate: string, terms: string, status: string): boolean {
  if (status !== "pending") return false;
  const ymd = parseIsoDate(invoiceDate);
  if (!ymd) return false;
  const dueOrdinal = ymdToOrdinal(ymd) + parseTermsDays(terms) * DAY_MS;
  const todayOrdinal = ymdToOrdinal(toEasternYmd(new Date()));
  return todayOrdinal > dueOrdinal;
}
