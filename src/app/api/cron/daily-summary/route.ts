import { NextResponse } from "next/server";
import { sendDailySummaryFor } from "@/lib/dailySummaryRun";
import { todayEasternISO } from "@/lib/workWeek";

// Vercel Cron calls this each evening with `Authorization: Bearer $CRON_SECRET`
// (same protection as the weekly invoice job) — it emails the boss everyone's
// clocked hours for the day. Days with no punches send nothing.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const date = todayEasternISO();
  const result = await sendDailySummaryFor(date);
  return NextResponse.json({ date, ...result }, { status: "error" in result && result.error ? 502 : 200 });
}
