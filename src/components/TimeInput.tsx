"use client";

// Deliberately uncontrolled (defaultValue, not value). A controlled time
// input writes its value back to the DOM on every keystroke; Safari's
// segmented time editor (hour / minute / AM-PM) loses its place when that
// happens mid-edit, which can make the field appear to reject typing
// entirely. We still get onChange for live calculations (e.g. total
// hours) — we just stop fighting the browser for ownership of the value.
export default function TimeInput({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <input
      type="time"
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
      className="input time-input"
    />
  );
}
