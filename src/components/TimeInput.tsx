"use client";

export default function TimeInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="time"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input time-input pr-9"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
      >
        <circle cx="10" cy="10" r="7.25" />
        <path d="M10 6v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
