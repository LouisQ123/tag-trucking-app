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
