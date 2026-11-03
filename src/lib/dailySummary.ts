// Builds the end-of-day "who worked how long" email from the day's punches.

export interface SummaryPunch {
  driver_name: string;
  clock_in: string;
  clock_out: string | null;
  truck_number: string | null;
  company: string | null;
  job: string | null;
  ticket_number: string | null;
}

const TZ = "America/New_York";
const round2 = (n: number) => Math.round(n * 100) / 100;
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const line = (v: string | null) => (v ?? "").replace(/[\r\n]+/g, " ").trim();

function hoursOf(p: SummaryPunch): number | null {
  return p.clock_out ? round2((new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 3600000) : null;
}

export interface DailySummary {
  subject: string;
  text: string;
  html: string;
  totalHours: number;
  drivers: number;
}

export function buildDailySummary(dateISO: string, punches: SummaryPunch[]): DailySummary {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dayLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const byDriver = new Map<string, SummaryPunch[]>();
  for (const p of [...punches].sort((a, b) => a.clock_in.localeCompare(b.clock_in))) {
    const list = byDriver.get(p.driver_name) ?? [];
    list.push(p);
    byDriver.set(p.driver_name, list);
  }
  const drivers = [...byDriver.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const totals = drivers.map(([name, list]) => ({
    name,
    list,
    hours: round2(list.reduce((a, p) => a + (hoursOf(p) ?? 0), 0)),
    open: list.some((p) => !p.clock_out),
  }));
  const totalHours = round2(totals.reduce((a, t) => a + t.hours, 0));
  const openCount = totals.filter((t) => t.open).length;

  const text: string[] = [`Hours for ${dayLabel}`, `${drivers.length} driver${drivers.length === 1 ? "" : "s"} · ${totalHours} total hours`, ""];
  for (const t of totals) {
    text.push(`${t.name} — ${t.hours} hrs${t.open ? "  (STILL CLOCKED IN / no clock-out)" : ""}`);
    for (const p of t.list) {
      const h = hoursOf(p);
      const where = [line(p.truck_number), line(p.company), line(p.job)].filter(Boolean).join(" · ");
      text.push(
        `   ${time(p.clock_in)} – ${p.clock_out ? time(p.clock_out) : "no clock-out"}` +
          `${h !== null ? ` (${h} hrs)` : ""}${where ? `  ${where}` : ""}${p.ticket_number ? `  ticket ${line(p.ticket_number)}` : ""}`
      );
    }
    text.push("");
  }
  text.push(`TOTAL: ${totalHours} hours`);
  if (openCount) text.push(`${openCount} driver${openCount === 1 ? "" : "s"} did not clock out — fix on the Time Clock page.`);

  const rows = totals
    .flatMap((t) =>
      t.list.map((p, i) => {
        const h = hoursOf(p);
        return `<tr>
          <td style="padding:6px 10px;border-top:1px solid #ddd;font-weight:${i === 0 ? "700" : "400"}">${i === 0 ? esc(t.name) : ""}</td>
          <td style="padding:6px 10px;border-top:1px solid #ddd">${time(p.clock_in)} – ${p.clock_out ? time(p.clock_out) : '<span style="color:#b45309;font-weight:700">no clock-out</span>'}</td>
          <td style="padding:6px 10px;border-top:1px solid #ddd;text-align:right">${h !== null ? h : "—"}</td>
          <td style="padding:6px 10px;border-top:1px solid #ddd">${esc(line(p.truck_number))}</td>
          <td style="padding:6px 10px;border-top:1px solid #ddd">${esc([line(p.company), line(p.job)].filter(Boolean).join(" / "))}</td>
          <td style="padding:6px 10px;border-top:1px solid #ddd">${esc(line(p.ticket_number))}</td>
        </tr>`;
      })
    )
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:720px">
    <h2 style="margin:0 0 4px">Hours for ${esc(dayLabel)}</h2>
    <p style="margin:0 0 14px;color:#555">${drivers.length} driver${drivers.length === 1 ? "" : "s"} · <b>${totalHours} total hours</b></p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="background:#4b1a3d;color:#fff;text-align:left">
        <th style="padding:6px 10px">Driver</th><th style="padding:6px 10px">In – Out</th>
        <th style="padding:6px 10px;text-align:right">Hours</th><th style="padding:6px 10px">Truck</th>
        <th style="padding:6px 10px">Company / Job</th><th style="padding:6px 10px">Ticket #</th>
      </tr>${rows}
    </table>
    <p style="margin:14px 0 0;font-size:15px"><b>Total: ${totalHours} hours</b></p>
    ${openCount ? `<p style="color:#b45309;margin:8px 0 0">${openCount} driver${openCount === 1 ? "" : "s"} did not clock out — fix on the Time Clock page.</p>` : ""}
  </div>`;

  return {
    subject: `Daily hours — ${dayLabel}: ${drivers.length} driver${drivers.length === 1 ? "" : "s"}, ${totalHours} hrs`,
    text: text.join("\n"),
    html,
    totalHours,
    drivers: drivers.length,
  };
}
