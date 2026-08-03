"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Deliberately its own dropdown, not a native <input list="..."> datalist —
// consistent with DateInput/TimeInput, this owns its rendering instead of
// depending on the browser's (visually inconsistent, hard to style) native
// autocomplete popover. Still free-text: picking a suggestion is a
// shortcut, not a requirement — anything typed is kept as-is.
export default function ComboInput({
  name,
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  className,
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
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

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => s.toLowerCase().includes(q));
  }, [value, suggestions]);

  function selectItem(item: string) {
    onChange(item);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          name={name}
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={className ?? "input"}
        />
        {suggestions.length > 0 && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <path d="M5.5 8l4.5 4.5L14.5 8" />
          </svg>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto w-full">
          {filtered.map((item) => (
            <button
              type="button"
              key={item}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(item)}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2 ${
                item === value ? "text-accent font-bold" : "text-ink"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
