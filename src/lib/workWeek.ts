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

export interface WorkWeek {
  weekStartOrdinal: number;
  weekEndOrdinal: number;
  dueDate: Date;
}

export function getCurrentWorkWeek(): WorkWeek {
  const todayOrdinal = ymdToOrdinal(toEasternYmd(new Date()));
  const weekday = new Date(todayOrdinal).getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const weekStartOrdinal = todayOrdinal + diffToMonday * DAY_MS;
  const weekEndOrdinal = weekStartOrdinal + 6 * DAY_MS;
  const dueDate = new Date(weekStartOrdinal + 7 * DAY_MS);
  return { weekStartOrdinal, weekEndOrdinal, dueDate };
}

export function isInWorkWeek(createdAt: string, week: WorkWeek): boolean {
  const ordinal = ymdToOrdinal(toEasternYmd(new Date(createdAt)));
  return ordinal >= week.weekStartOrdinal && ordinal <= week.weekEndOrdinal;
}

export function formatSubmitBy(week: WorkWeek): string {
  return week.dueDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
