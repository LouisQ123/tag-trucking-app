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
    <input
      type="time"
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input time-input"
    />
  );
}
