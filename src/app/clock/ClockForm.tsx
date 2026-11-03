"use client";

import { useState } from "react";
import { clockIn, clockOut, clockVerify, type ClockState } from "@/lib/actions/clock";
import { YARD, type Position } from "@/lib/yard";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Asks the phone where it is right now (not a cached reading).
function getPosition(): Promise<Position | { error: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ error: "This device can't share its location, so it can't be used to clock in." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) =>
        resolve({
          error:
            err.code === err.PERMISSION_DENIED
              ? `Location is blocked. Allow location for this site in your browser settings, then try again. You can only clock in and out at the yard (${YARD.address}).`
              : "We couldn't find your location. Try again outside with GPS on.",
        }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export default function ClockForm({ names }: { names: { id: string; name: string }[] }) {
  const [driverId, setDriverId] = useState("");
  const [pin, setPin] = useState("");
  const [state, setState] = useState<ClockState | null>(null);
  const [truck, setTruck] = useState("");
  const [company, setCompany] = useState("");
  const [job, setJob] = useState("");
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function reset(msg: string | null) {
    setDriverId("");
    setPin("");
    setState(null);
    setTruck("");
    setCompany("");
    setJob("");
    setTicket("");
    setError(null);
    setMessage(msg);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await clockVerify(driverId, pin);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      setPin("");
      return;
    }
    setState(result.state);
    setTicket(result.state.open?.ticketNumber ?? "");
  }

  async function doClockIn() {
    setBusy(true);
    setError(null);
    const pos = await getPosition();
    if ("error" in pos) {
      setBusy(false);
      setError(pos.error);
      return;
    }
    const result = await clockIn(driverId, pin, truck, company, job, pos);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    reset(`Clocked in at ${fmtTime(result.state.open?.clockIn ?? new Date().toISOString())}. Have a safe day!`);
  }

  async function doClockOut() {
    setBusy(true);
    setError(null);
    const pos = await getPosition();
    if ("error" in pos) {
      setBusy(false);
      setError(pos.error);
      return;
    }
    const result = await clockOut(driverId, pin, ticket, pos);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    reset(`Clocked out. You worked ${result.hours} hours.`);
  }

  // The shared app input style — it also restyles <select> so the name and
  // truck dropdowns match the text boxes.
  const inputClass = "input";
  const labelClass = "text-xs font-bold uppercase tracking-wide text-ink-2";

  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
      {message && (
        <div className="rounded-lg bg-good/10 border border-good/30 text-sm font-semibold text-good px-4 py-3">
          {message}
        </div>
      )}
      {error && <p className="text-sm font-semibold text-critical">{error}</p>}

      {!state ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="clock-name">
              Your name
            </label>
            <select
              id="clock-name"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose your name…</option>
              {names.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="clock-pin">
              PIN
            </label>
            <input
              id="clock-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && driverId && pin.length === 4 && !busy) verify();
              }}
              inputMode="numeric"
              type="password"
              autoComplete="off"
              placeholder="4 digits"
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={busy || !driverId || pin.length !== 4}
            className="rounded-md bg-accent text-accent-ink font-bold text-sm py-2.5 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Continue"}
          </button>
          {names.length === 0 && (
            <p className="text-xs text-muted text-center">No one has a PIN yet — an admin sets them on the Roster.</p>
          )}
        </>
      ) : state.open ? (
        <>
          <div className="text-center">
            <p className="font-extrabold text-base">{state.name}</p>
            <p className="text-sm text-ink-2 mt-1">
              Clocked in since <span className="font-bold text-ink">{fmtTime(state.open.clockIn)}</span> on{" "}
              {fmtDay(state.open.clockIn)}
            </p>
            <p className="text-sm text-ink-2">
              {[state.open.truck, state.open.company, state.open.job].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="clock-ticket-out">
              Ticket number(s)
            </label>
            <input
              id="clock-ticket-out"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              className={inputClass}
              placeholder="Your ticket #"
            />
          </div>
          <button
            type="button"
            onClick={doClockOut}
            disabled={busy || !ticket.trim()}
            className="rounded-md bg-critical text-white font-bold text-sm py-3 disabled:opacity-60"
          >
            {busy ? "Checking location…" : "Clock Out"}
          </button>
          <button type="button" onClick={() => reset(null)} className="text-xs font-bold text-ink-2 hover:text-ink">
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="font-extrabold text-base text-center">{state.name}</p>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="clock-truck">
              Truck
            </label>
            <select id="clock-truck" value={truck} onChange={(e) => setTruck(e.target.value)} className={inputClass}>
              <option value="">Choose your truck…</option>
              {state.trucks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="clock-company">
              Company you&apos;re working for
            </label>
            <input
              id="clock-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={inputClass}
              placeholder="P3 Contractors"
              maxLength={80}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="clock-job">
              Job
            </label>
            <input
              id="clock-job"
              value={job}
              onChange={(e) => setJob(e.target.value)}
              className={inputClass}
              placeholder="Carney"
              maxLength={120}
            />
          </div>
          <button
            type="button"
            onClick={doClockIn}
            disabled={busy || !truck || !company.trim() || !job.trim()}
            className="rounded-md bg-good text-white font-bold text-sm py-3 disabled:opacity-60"
          >
            {busy ? "Checking location…" : "Clock In"}
          </button>
          <button type="button" onClick={() => reset(null)} className="text-xs font-bold text-ink-2 hover:text-ink">
            Cancel
          </button>
        </>
      )}
      <p className="text-[11px] text-muted text-center leading-relaxed">
        You can only clock in and out at the yard, {YARD.address}. Your phone will ask to share its location.
      </p>
    </div>
  );
}
