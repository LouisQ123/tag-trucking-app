"use client";

import { useEffect, useRef, useState } from "react";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseISO(iso?: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDisplay(iso: string): string {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Deliberately its own popover, not a native <input type="date"> — this
// codebase spent a long time chasing Safari-specific rendering bugs on
// native date/time controls (box-sizing, invisible icons, inconsistent
// height). Owning the whole UI sidesteps that category of bug entirely.
export default function DateInput({
  name,
  defaultValue,
  onChange,
  required,
  className,
  ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const initial = parseISO(defaultValue) ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [yearRangeStart, setYearRangeStart] = useState(initial.getFullYear() - 5);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPicker() {
    const cur = parseISO(value) ?? new Date();
    setViewYear(cur.getFullYear());
    setViewMonth(cur.getMonth());
    setYearRangeStart(cur.getFullYear() - 5);
    setMode("days");
    setOpen((o) => !o);
  }

  function selectDay(d: Date) {
    const iso = toISO(d);
    setValue(iso);
    onChange?.(iso);
    setOpen(false);
  }

  function selectYear(y: number) {
    setViewYear(y);
    setMode("months");
  }

  function selectMonth(m: number) {
    setViewMonth(m);
    setMode("days");
  }

  function openYears() {
    setYearRangeStart(viewYear - 5);
    setMode("years");
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handlePrev() {
    if (mode === "days") prevMonth();
    else if (mode === "months") setViewYear((y) => y - 1);
    else setYearRangeStart((y) => y - 12);
  }
  function handleNext() {
    if (mode === "days") nextMonth();
    else if (mode === "months") setViewYear((y) => y + 1);
    else setYearRangeStart((y) => y + 12);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewYear, viewMonth, d), inMonth: true });
  }
  let trail = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(viewYear, viewMonth + 1, trail), inMonth: false });
    trail += 1;
  }

  const selectedDate = parseISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="relative" ref={wrapRef}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel}
        className={className ?? "input flex items-center justify-between gap-2"}
      >
        <span className={value ? "" : "text-muted"}>{value ? fmtDisplay(value) : "Select date"}</span>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-none">
          <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
          <path d="M3.5 8h13M7 3v3M13 3v3" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 bg-surface border border-border rounded-xl shadow-lg p-3 w-[280px]">
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous"
              className="w-7 h-7 rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink flex items-center justify-center flex-none"
            >
              ‹
            </button>

            {mode === "days" && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setMode("months")}
                  className="text-[13px] font-bold rounded-md px-2 py-1 hover:bg-surface-2"
                >
                  {MONTH_LABELS[viewMonth]}
                </button>
                <button
                  type="button"
                  onClick={openYears}
                  className="text-[13px] font-bold rounded-md px-2 py-1 hover:bg-surface-2 tabular-nums"
                >
                  {viewYear}
                </button>
              </div>
            )}
            {mode === "months" && (
              <button
                type="button"
                onClick={openYears}
                className="text-[13px] font-bold rounded-md px-2 py-1 hover:bg-surface-2 tabular-nums"
              >
                {viewYear}
              </button>
            )}
            {mode === "years" && (
              <span className="text-[13px] font-bold px-2 py-1 tabular-nums">
                {yearRangeStart} – {yearRangeStart + 11}
              </span>
            )}

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next"
              className="w-7 h-7 rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink flex items-center justify-center flex-none"
            >
              ›
            </button>
          </div>

          {mode === "years" && (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((y) => (
                <button
                  type="button"
                  key={y}
                  onClick={() => selectYear(y)}
                  className={`h-9 rounded-md text-[13px] font-semibold tabular-nums ${
                    y === viewYear
                      ? "bg-accent text-accent-ink"
                      : y === today.getFullYear()
                        ? "border border-accent text-accent"
                        : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {mode === "months" && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_SHORT.map((label, m) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => selectMonth(m)}
                  className={`h-9 rounded-md text-[13px] font-semibold ${
                    m === viewMonth
                      ? "bg-accent text-accent-ink"
                      : viewYear === today.getFullYear() && m === today.getMonth()
                        ? "border border-accent text-accent"
                        : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === "days" && (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted mb-1">
                {WEEKDAY_LABELS.map((w, i) => (
                  <div key={`${w}-${i}`}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map(({ date, inMonth }, i) => {
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, today);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => selectDay(date)}
                      className={`h-8 w-8 rounded-md text-xs font-semibold tabular-nums ${
                        isSelected
                          ? "bg-accent text-accent-ink"
                          : isToday
                            ? "border border-accent text-accent"
                            : inMonth
                              ? "text-ink hover:bg-surface-2"
                              : "text-muted/50 hover:bg-surface-2"
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
