"use client";

import { useEffect, useRef, useState } from "react";

function parseTime(v?: string): { h: number; m: number } | null {
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}
function fmtDisplay(v: string): string {
  const t = parseTime(v);
  if (!t) return "";
  const period = t.h >= 12 ? "PM" : "AM";
  const h12 = t.h % 12 || 12;
  return `${h12}:${String(t.m).padStart(2, "0")} ${period}`;
}
function to24Hour(h12: number, period: "AM" | "PM"): number {
  if (period === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: Array<"AM" | "PM"> = ["AM", "PM"];

function ScrollColumn<T extends string | number>({
  items,
  selected,
  onSelect,
  format,
  open,
}: {
  items: T[];
  selected: T | null;
  onSelect: (item: T) => void;
  format: (item: T) => string;
  open: boolean;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) selectedRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className="flex-1 h-40 overflow-y-auto flex flex-col items-stretch gap-0.5 scroll-py-1">
      {items.map((item) => {
        const isSelected = selected !== null && item === selected;
        return (
          <button
            type="button"
            key={item}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onSelect(item)}
            className={`shrink-0 rounded-md text-[13px] font-semibold tabular-nums py-1.5 ${
              isSelected ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            {format(item)}
          </button>
        );
      })}
    </div>
  );
}

// Deliberately its own popover, not a native <input type="time"> — this
// codebase spent a long time chasing Safari-specific rendering bugs on
// native date/time controls (box-sizing, invisible icons, segmented-editor
// focus loss on every re-render). Owning the whole UI sidesteps all of it.
export default function TimeInput({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
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

  const t = parseTime(value);
  const h12 = t ? t.h % 12 || 12 : null;
  const minute = t ? t.m : null;
  const period: "AM" | "PM" = t ? (t.h >= 12 ? "PM" : "AM") : "AM";

  function commit(nextH12: number, nextMinute: number, nextPeriod: "AM" | "PM") {
    const h24 = to24Hour(nextH12, nextPeriod);
    const v = `${String(h24).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
    setValue(v);
    onChange?.(v);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => {
          // Anchoring from the trigger's actual position (rather than
          // always left-aligning) keeps the popover from overflowing off
          // the right edge of a phone screen.
          const rect = wrapRef.current?.getBoundingClientRect();
          setAlignRight(!!rect && rect.left + 200 > window.innerWidth - 8);
          setOpen((o) => !o);
        }}
        className="input flex items-center justify-between gap-2"
      >
        <span className={value ? "" : "text-muted"}>{value ? fmtDisplay(value) : "Select time"}</span>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-none">
          <circle cx="10" cy="10" r="7.25" />
          <path d="M10 6v4l2.5 2" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-20 mt-1.5 bg-surface border border-border rounded-xl shadow-lg p-2 flex gap-1 w-[200px] max-w-[calc(100vw-24px)] ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          <ScrollColumn
            items={HOURS}
            selected={h12}
            open={open}
            format={(h) => String(h)}
            onSelect={(h) => commit(h, minute ?? 0, period)}
          />
          <ScrollColumn
            items={MINUTES}
            selected={minute}
            open={open}
            format={(m) => String(m).padStart(2, "0")}
            onSelect={(m) => commit(h12 ?? 12, m, period)}
          />
          <ScrollColumn
            items={PERIODS}
            selected={t ? period : null}
            open={open}
            format={(p) => p}
            onSelect={(p) => commit(h12 ?? 12, minute ?? 0, p)}
          />
        </div>
      )}
    </div>
  );
}
