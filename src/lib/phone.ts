// Normalizes a US-style phone number to E.164 (e.g. "+15551234567") for use
// as a Supabase Auth identifier. Returns null if it doesn't look like a
// valid 10 (or 11, with leading 1) digit US number.
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// The last 10 digits of a phone number, for loosely matching two numbers
// regardless of formatting ("(555) 555-5555" vs "+15555555555" vs "5555555555").
export function last10Digits(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}
