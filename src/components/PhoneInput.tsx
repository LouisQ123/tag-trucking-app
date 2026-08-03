"use client";

import { useState } from "react";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function PhoneInput({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(formatPhone(defaultValue ?? ""));

  return (
    <input
      name={name}
      type="tel"
      inputMode="tel"
      value={value}
      onChange={(e) => setValue(formatPhone(e.target.value))}
      placeholder="(555) 555-5555"
      className="input"
    />
  );
}
