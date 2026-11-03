// Emails the boss when someone clocks in. Uses Resend's HTTP API. Configured
// with environment variables; if they're missing this does nothing, so a
// misconfiguration can never get in the way of anyone clocking in.
//
//   RESEND_API_KEY   — from resend.com
//   CLOCK_ALERT_TO   — who gets it; one address or several separated by commas
//   CLOCK_ALERT_FROM — optional, e.g. "ATG Time Clock <clock@atgtruckingllc.com>"
//                      (defaults to Resend's shared test sender, which can only
//                      deliver to the Resend account owner's own address)

export interface ClockAlert {
  name: string;
  clockInISO: string;
  truck: string;
  company: string;
  job: string;
}

// Drivers type these in, so keep them to one tidy line.
const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

export function clockAlertConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.CLOCK_ALERT_TO;
}

function recipients(): string[] {
  return (process.env.CLOCK_ALERT_TO ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

// Sends one email to the alert recipients. `html` is optional; the plain text
// is always included.
export async function sendAlertEmail(opts: {
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = recipients();
  if (!apiKey || !to.length) return { ok: false, error: "Email alerts aren't configured." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CLOCK_ALERT_FROM || "ATG Time Clock <onboarding@resend.dev>",
        to,
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Email service said ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach the email service." };
  }
}

export async function sendClockInAlert(alert: ClockAlert): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = oneLine(alert.name);
  const company = oneLine(alert.company);
  const job = oneLine(alert.job);
  const when = new Date(alert.clockInISO).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return sendAlertEmail({
    subject: `${name} clocked in — ${company}${job ? ` / ${job}` : ""}`,
    text: [
      `${name} clocked in at ${when}.`,
      "",
      `Company: ${company}`,
      `Job: ${job || "—"}`,
      `Truck: ${oneLine(alert.truck) || "—"}`,
    ].join("\n"),
  });
}
